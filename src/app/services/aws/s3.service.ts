/* =============================================================================
 * S3Service – optimized, usage-compatible
 * -----------------------------------------------------------------------------
 * Improvements (no call-site changes required):
 *  • Strongly typed cfg → fixes TS7044
 *  • Client reuse via an internal cache (avoid creating S3Client every call)
 *  • listFolders() pagination + small in-memory TTL cache (default 60s)
 *  • download<T>() generic return for better inference (still optional)
 *  • Defensive JSON parse with clearer error messages
 *  • NEW: listPrivateObjects() + deletePrivateObjects() for Admin storage tab
 *  • Optional session token + private bucket alias resolution
 * ============================================================================ */

import {Injectable} from '@angular/core';

/* ---------- AWS SDK v3 ---------- */
import {
    S3Client,
    GetObjectCommand,
    ListObjectsV2Command,
    HeadObjectCommand,
    DeleteObjectsCommand,
    GetObjectCommandOutput,
    ListObjectsV2CommandOutput,
    HeadObjectCommandOutput,
    DeleteObjectsCommandOutput
} from '@aws-sdk/client-s3';
import {Upload} from '@aws-sdk/lib-storage';

/* ---------- Local debug JSON (default imports) ---------- */
import localRawDimensions from '../../../../data/build/task/dimensions.json';
import localRawHits from '../../../../data/build/task/hits.json';
import localRawInstructionsDimensions from '../../../../data/build/task/instructions_evaluation.json';
import localRawQuestionnaires from '../../../../data/build/task/questionnaires.json';
import localRawTaskSettings from '../../../../data/build/task/task.json';
import localRawSearchEngineSettings from '../../../../data/build/task/search_engine.json';
import localRawWorkers from '../../../../data/build/task/workers.json';
import localRawInstructionsMain from '../../../../data/build/task/instructions_general.json';
import localRawAdmin from '../../../../data/build/config/admin.json';

/* ---------- Domain models ---------- */
import {Worker} from '../../models/worker/worker';

/* Minimal, stable shape of the config object used across calls */
export interface S3Config {
    region: string;
    bucket: string;
    aws_id_key: string;
    aws_secret_key: string;
    aws_session_token?: string;     // NEW: support STS
    configuration_local?: boolean;
    taskName?: string;
    batchName?: string;

    /* Optional private bucket (falls back to bucket if unspecified) */
    private_bucket?: string;        // snake_case
    bucket_private?: string;        // alias
    privateBucket?: string;         // camelCase
}

@Injectable({providedIn: 'root'})
export class S3Service {

    /* --------------------------------------------------------------------------
     * Client reuse: create clients once per (region + credentials + token) combo
     * ------------------------------------------------------------------------ */
    private clientCache = new Map<string, S3Client>();

    private getClient(cfg: S3Config): S3Client {
        const key = `${cfg.region}:${cfg.aws_id_key}:${cfg.aws_secret_key}:${cfg.aws_session_token || ''}`;
        let client = this.clientCache.get(key);
        if (!client) {
            client = new S3Client({
                region: cfg.region,
                credentials: {
                    accessKeyId: cfg.aws_id_key,
                    secretAccessKey: cfg.aws_secret_key,
                    sessionToken: cfg.aws_session_token
                }
            });
            this.clientCache.set(key, client);
        }
        return client;
    }

    /* Backwards-compatible alias (keeps existing call sites & tests happy) */
    private buildClient(cfg: S3Config): S3Client {
        return this.getClient(cfg);
    }

    /* Resolve private bucket name with aliases, fallback to main bucket */
    private resolvePrivateBucket(cfg: S3Config): string {
        return (
            cfg.private_bucket ||
            cfg.bucket_private ||
            cfg.privateBucket ||
            cfg.bucket
        );
    }

    /* ---------- BASIC CRUD ---------- */

    /** Download & JSON-parse a file from S3 (generic type-friendly) */
    async download<T = any>(cfg: S3Config, key: string): Promise<T> {
        const s3 = this.buildClient(cfg);
        const {Body}: GetObjectCommandOutput = await s3.send(
            new GetObjectCommand({Bucket: cfg.bucket, Key: key})
        );

        /* Browser-safe way to read the stream */
        const text = await new Response(Body as any).text();

        try {
            return JSON.parse(text) as T;
        } catch (e) {
            throw new Error(`S3Service.download: invalid JSON at key "${key}": ${(e as Error)?.message || e}`);
        }
    }

    /** Multipart-aware upload (uses @aws-sdk/lib-storage) */
    async upload(cfg: S3Config, key: string, payload: unknown) {
        const s3 = this.buildClient(cfg);
        const uploader = new Upload({
            client: s3,
            params: {
                Bucket: cfg.bucket,
                Key: key,
                Body: typeof payload === 'string' ? payload : JSON.stringify(payload),
                ContentType: 'application/json'
            }
        });
        return uploader.done();
    }

    /** OPTIONAL: Fetch only object metadata (ETag, LastModified) without body */
    async headObject(cfg: S3Config, key: string): Promise<HeadObjectCommandOutput> {
        const s3 = this.buildClient(cfg);
        return s3.send(new HeadObjectCommand({Bucket: cfg.bucket, Key: key}));
    }

    /* --------------------------------------------------------------------------
     * listFolders – returns CommonPrefixes for a prefix (paginated + cached)
     *   • Keeps the same return shape: Array<{ Prefix: string }>
     *   • Adds a tiny in-memory TTL cache (default 60s) to avoid re-listing
     * ------------------------------------------------------------------------ */
    private static readonly LIST_TTL_MS = 60 * 1000;
    private foldersCache = new Map<string, { ts: number; prefixes: Array<{ Prefix: string }> }>();

    async listFolders(cfg: S3Config, prefix: string = ''): Promise<Array<{ Prefix: string }>> {
        const s3 = this.buildClient(cfg);
        const cacheKey = `${cfg.bucket}|${cfg.region}|${prefix}`;

        const cached = this.foldersCache.get(cacheKey);
        if (cached && (Date.now() - cached.ts) < S3Service.LIST_TTL_MS) {
            return cached.prefixes;
        }

        let ContinuationToken: string | undefined = undefined;
        const dedup = new Set<string>();
        const allPrefixes: Array<{ Prefix: string }> = [];

        do {
            const resp: ListObjectsV2CommandOutput = await s3.send(
                new ListObjectsV2Command({
                    Bucket: cfg.bucket,
                    Prefix: prefix || undefined,
                    Delimiter: '/',
                    ContinuationToken
                })
            );

            if (resp.CommonPrefixes?.length) {
                for (const p of resp.CommonPrefixes) {
                    if (p?.Prefix && !dedup.has(p.Prefix)) {
                        dedup.add(p.Prefix);
                        allPrefixes.push({Prefix: p.Prefix});
                    }
                }
            }

            ContinuationToken = resp.IsTruncated ? resp.NextContinuationToken : undefined;
        } while (ContinuationToken);

        this.foldersCache.set(cacheKey, {ts: Date.now(), prefixes: allPrefixes});
        return allPrefixes;
    }

    /* ---------- PATH HELPERS ---------- */

    getTaskDataS3Path(cfg: S3Config, name: string, batch: string) {
        return `${cfg.region}/${cfg.bucket}/${name}/${batch}`;
    }

    getFolder(cfg: S3Config) {
        return cfg.batchName ? `${cfg.taskName}/${cfg.batchName}/` : `${cfg.taskName}/`;
    }

    getWorkerFolder(cfg: S3Config, worker: Worker) {
        return `${this.getFolder(cfg)}Data/${worker.identifier}/`;
    }

    /* ---------- FILE DOWNLOADERS ---------- */

    downloadAdministrators(cfg: S3Config) {
        const file = `${this.getFolder(cfg)}Generator/admin.json`;
        return cfg.configuration_local ? localRawAdmin : this.download(cfg, file);
    }

    downloadTaskSettings(cfg: S3Config) {
        const file = `${this.getFolder(cfg)}Task/task.json`;
        return cfg.configuration_local ? localRawTaskSettings : this.download(cfg, file);
    }

    downloadSearchEngineSettings(cfg: S3Config) {
        const file = `${this.getFolder(cfg)}Task/search_engine.json`;
        return cfg.configuration_local ? localRawSearchEngineSettings : this.download(cfg, file);
    }

    downloadHits(cfg: S3Config) {
        const file = `${this.getFolder(cfg)}Task/hits.json`;
        return cfg.configuration_local ? localRawHits : this.download(cfg, file);
    }

    downloadGeneralInstructions(cfg: S3Config) {
        const file = `${this.getFolder(cfg)}Task/instructions_general.json`;
        return cfg.configuration_local ? localRawInstructionsMain : this.download(cfg, file);
    }

    downloadEvaluationInstructions(cfg: S3Config) {
        const file = `${this.getFolder(cfg)}Task/instructions_evaluation.json`;
        return cfg.configuration_local ? localRawInstructionsDimensions : this.download(cfg, file);
    }

    downloadDimensions(cfg: S3Config) {
        const file = `${this.getFolder(cfg)}Task/dimensions.json`;
        return cfg.configuration_local ? localRawDimensions : this.download(cfg, file);
    }

    downloadQuestionnaires(cfg: S3Config) {
        const file = `${this.getFolder(cfg)}Task/questionnaires.json`;
        return cfg.configuration_local ? localRawQuestionnaires : this.download(cfg, file);
    }

    downloadWorkers(cfg: S3Config, batch: string | null = null): Promise<any> {
        const file = batch
            ? `${batch}Task/workers.json`
            : `${this.getFolder(cfg)}Task/workers.json`;

        return batch || !cfg.configuration_local
            ? this.download(cfg, file)
            : Promise.resolve(localRawWorkers);
    }

    /* ---------- STATIC PATH HELPERS ---------- */

    getQuestionnairesConfigPath(cfg: S3Config) {
        return `${cfg.taskName}/${cfg.batchName}/Task/questionnaires.json`;
    }

    getHitsConfigPath(cfg: S3Config) {
        return `${cfg.taskName}/${cfg.batchName}/Task/hits.json`;
    }

    getDimensionsConfigPath(cfg: S3Config) {
        return `${cfg.taskName}/${cfg.batchName}/Task/dimensions.json`;
    }

    getTaskInstructionsConfigPath(cfg: S3Config) {
        return `${cfg.taskName}/${cfg.batchName}/Task/instructions_general.json`;
    }

    getDimensionsInstructionsConfigPath(cfg: S3Config) {
        return `${cfg.taskName}/${cfg.batchName}/Task/instructions_evaluation.json`;
    }

    getSearchEngineSettingsConfigPath(cfg: S3Config) {
        return `${cfg.taskName}/${cfg.batchName}/Task/search_engine.json`;
    }

    getTaskSettingsConfigPath(cfg: S3Config) {
        return `${cfg.taskName}/${cfg.batchName}/Task/task.json`;
    }

    getWorkerChecksConfigPath(cfg: S3Config) {
        return `${cfg.taskName}/${cfg.batchName}/Task/workers.json`;
    }

    /* ---------- CONFIG UPLOADERS ---------- */

    uploadQuestionnairesConfig(cfg: S3Config, data: unknown) {
        return this.upload(cfg, this.getQuestionnairesConfigPath(cfg), data);
    }

    uploadHitsConfig(cfg: S3Config, data: unknown) {
        return this.upload(cfg, this.getHitsConfigPath(cfg), data);
    }

    uploadDimensionsConfig(cfg: S3Config, data: unknown) {
        return this.upload(cfg, this.getDimensionsConfigPath(cfg), data);
    }

    uploadTaskInstructionsConfig(cfg: S3Config, data: unknown) {
        return this.upload(cfg, this.getTaskInstructionsConfigPath(cfg), data);
    }

    uploadDimensionsInstructionsConfig(cfg: S3Config, data: unknown) {
        return this.upload(cfg, this.getDimensionsInstructionsConfigPath(cfg), data);
    }

    uploadSearchEngineSettings(cfg: S3Config, data: unknown) {
        return this.upload(cfg, this.getSearchEngineSettingsConfigPath(cfg), data);
    }

    uploadTaskSettings(cfg: S3Config, data: unknown) {
        return this.upload(cfg, this.getTaskSettingsConfigPath(cfg), data);
    }

    uploadWorkersCheck(cfg: S3Config, data: unknown) {
        return this.upload(cfg, this.getWorkerChecksConfigPath(cfg), data);
    }

    /* ============================================================================
     * NEW: Private bucket helpers for Admin “Storage” tab
     * ========================================================================== */

    /**
     * List objects from the **private bucket** (falls back to cfg.bucket).
     * Returns the raw ListObjectsV2CommandOutput so callers can read
     * `Contents` and `NextContinuationToken`.
     */
    async listPrivateObjects(
        cfg: S3Config,
        opts: { prefix?: string; continuationToken?: string; maxKeys?: number } = {}
    ): Promise<ListObjectsV2CommandOutput> {
        if (cfg.configuration_local) {
            // Local dev: return an empty, well-shaped result
            return {
                $metadata: {},
                IsTruncated: false,
                KeyCount: 0,
                MaxKeys: opts.maxKeys ?? 1000,
                Name: this.resolvePrivateBucket(cfg),
                Prefix: opts.prefix || ''
            } as ListObjectsV2CommandOutput;
        }

        const s3 = this.buildClient(cfg);
        const Bucket = this.resolvePrivateBucket(cfg);

        return s3.send(new ListObjectsV2Command({
            Bucket,
            Prefix: opts.prefix || undefined,
            ContinuationToken: opts.continuationToken || undefined,
            MaxKeys: opts.maxKeys ?? 1000
        }));
    }

    /**
     * Bulk delete keys from the **private bucket** (falls back to cfg.bucket).
     * Handles S3 limit of 1000 objects per request via chunking.
     */
    async deletePrivateObjects(cfg: S3Config, keys: string[]): Promise<void> {
        if (!keys || keys.length === 0) return;
        if (cfg.configuration_local) return; // no-op in local mode

        const s3 = this.buildClient(cfg);
        const Bucket = this.resolvePrivateBucket(cfg);

        const CHUNK = 1000;
        for (let i = 0; i < keys.length; i += CHUNK) {
            const slice = keys.slice(i, i + CHUNK);
            await s3.send(new DeleteObjectsCommand({
                Bucket,
                Delete: {
                    Objects: slice.map(k => ({Key: k})),
                    Quiet: true
                }
            })) as DeleteObjectsCommandOutput;
        }
    }
}
