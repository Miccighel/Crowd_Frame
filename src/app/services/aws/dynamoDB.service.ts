import {Injectable} from '@angular/core';

/* ---------- AWS SDK v3 ---------- */
import {
    DynamoDBClient,
    ListTablesCommand,
    ListTablesCommandOutput,
    DescribeTableCommand,
    DescribeTableCommandOutput
} from '@aws-sdk/client-dynamodb';
import {
    DynamoDBDocumentClient,
    QueryCommand, QueryCommandOutput,
    ScanCommand, ScanCommandOutput,
    PutCommand, PutCommandOutput,
    UpdateCommand, UpdateCommandOutput,
    DeleteCommand, DeleteCommandOutput
} from '@aws-sdk/lib-dynamodb';

/* ---------- Domain models ---------- */
import {Worker} from '../../models/worker/worker';
import {Task} from '../../models/skeleton/task';
import {StatusCodes} from '../section.service';

/* ---------- External config shape used by callers ---------- */
type Cfg = {
    region: string;
    aws_id_key: string;
    aws_secret_key: string;
    table_acl_name: string;
    table_data_name: string;
};

/* ---------- Internal normalized config ---------- */
type NormalizedCfg = {
    region: string;
    accessKeyId: string;
    secretAccessKey: string;
    sessionToken?: string;
    table_acl_name: string;
    table_data_name: string;
    cacheKey: string; /* region + creds fingerprint for client cache */
};

@Injectable({providedIn: 'root'})
export class DynamoDBService {
    /* ================== CLIENT CACHE ================== */
    private _base?: DynamoDBClient;                 /* low-level client cache */
    private _doc?: DynamoDBDocumentClient;          /* document client cache */
    private _cfgKey?: string;                       /* cache discriminator */

    /* Cache of table key schema to avoid repetitive DescribeTable calls */
    private _schemaCache = new Map<string, { pk: string; sk?: string; types: Record<string, 'S' | 'N' | 'B'> }>();

    /* ================== CONFIG NORMALIZATION ================== */

    /* Accepts multiple key spellings, returns a normalized shape */
    private normalize(raw: Cfg | any): NormalizedCfg {
        const region =
            raw?.region ?? raw?.aws_region ?? raw?.AWS_REGION ?? raw?.region_name;

        const accessKeyId =
            raw?.aws_id_key ??
            raw?.aws_access_key_id ??
            raw?.accessKeyId ??
            raw?.AWS_ACCESS_KEY_ID;

        const secretAccessKey =
            raw?.aws_secret_key ??
            raw?.aws_secret_access_key ??
            raw?.secretAccessKey ??
            raw?.AWS_SECRET_ACCESS_KEY;

        const sessionToken =
            raw?.aws_session_token ?? raw?.sessionToken ?? raw?.AWS_SESSION_TOKEN;

        const table_acl_name =
            raw?.table_acl_name ?? raw?.TABLE_ACL_NAME ?? raw?.acl_table ?? raw?.acl;

        const table_data_name =
            raw?.table_data_name ?? raw?.TABLE_DATA_NAME ?? raw?.data_table ?? raw?.data;

        if (!region || !accessKeyId || !secretAccessKey) {
            console.error('[DDB] Missing required config fields', {
                regionSet: !!region,
                accessKeyIdSet: !!accessKeyId,
                secretAccessKeySet: !!secretAccessKey,
                sessionTokenSet: !!sessionToken
            });
        }

        /* Include sessionToken in the cache key so STS rotations rebuild the client */
        const cacheKey = [region || '', accessKeyId || '', sessionToken || ''].join('|');

        return {
            region,
            accessKeyId,
            secretAccessKey,
            sessionToken,
            table_acl_name,
            table_data_name,
            cacheKey
        };
    }

    /* Ensure clients exist and match the provided (normalized) config */
    private ensureClients(rawCfg: Cfg | any): NormalizedCfg {
        const cfg = this.normalize(rawCfg);
        if (!this._base || !this._doc || this._cfgKey !== cfg.cacheKey) {
            this._base = new DynamoDBClient({
                region: cfg.region,
                credentials: {
                    accessKeyId: cfg.accessKeyId,
                    secretAccessKey: cfg.secretAccessKey,
                    sessionToken: cfg.sessionToken
                }
                /* logger: console, // uncomment for verbose SDK logs in dev */
            });
            this._doc = DynamoDBDocumentClient.from(this._base);
            this._cfgKey = cfg.cacheKey;
            console.log('[DDB] Client initialized', {region: cfg.region});
        }
        return cfg;
    }

    private getBase(): DynamoDBClient {
        if (!this._base) throw new Error('[DDB] Low-level client not initialized (invalid cfg)');
        return this._base;
    }

    private getDoc(): DynamoDBDocumentClient {
        if (!this._doc) throw new Error('[DDB] Document client not initialized (invalid cfg)');
        return this._doc;
    }

    /* Centralized sender with compact error logging; preserves output types via T */
    private async send<T>(
        client: DynamoDBClient | DynamoDBDocumentClient,
        command: any,
        op: string
    ): Promise<T> {
        try {
            // @ts-ignore
            return await client.send(command) as T;
        } catch (err: any) {
            console.error(`[DDB] ${op} failed`, {
                name: err?.name,
                message: err?.message,
                code: err?.code || err?.Code,
                httpStatus: err?.$metadata?.httpStatusCode,
                requestId: err?.$metadata?.requestId
            });
            throw err;
        }
    }

    /* ======================== HEALTH ===================== */

    /* Lightweight connectivity check; surfaces AWS errors clearly */
    async ping(cfg: Cfg | any): Promise<void> {
        this.ensureClients(cfg);
        await this.send<ListTablesCommandOutput>(
            this.getBase(),
            new ListTablesCommand({Limit: 1}),
            'ListTables(ping)'
        );
    }

    /* ===================== INTROSPECTION ==================== */

    /* Describes a table; used internally to discover PK/SK and attribute types */
    private async describeTable(tableName: string): Promise<DescribeTableCommandOutput> {
        return this.send<DescribeTableCommandOutput>(
            this.getBase(),
            new DescribeTableCommand({TableName: tableName}),
            `DescribeTable(${tableName})`
        );
    }

    /* Returns {pk, sk?, types} for the given table; cached for subsequent calls */
    private async getAclKeySchema(tableName: string): Promise<{ pk: string; sk?: string; types: Record<string, 'S' | 'N' | 'B'> }> {
        const cached = this._schemaCache.get(tableName);
        if (cached) return cached;

        const desc = await this.describeTable(tableName);
        const ks = desc.Table?.KeySchema ?? [];
               const attrs = desc.Table?.AttributeDefinitions ?? [];

        const types: Record<string, 'S' | 'N' | 'B'> = {};
        for (const a of attrs) {
            if (a.AttributeName && a.AttributeType) {
                types[a.AttributeName] = a.AttributeType as 'S' | 'N' | 'B';
            }
        }

        const pk = ks.find(k => k.KeyType === 'HASH')?.AttributeName!;
        const sk = ks.find(k => k.KeyType === 'RANGE')?.AttributeName;

        if (!pk) throw new Error('[DDB] ACL table has no HASH key');

        const schema = {pk, sk, types};
        this._schemaCache.set(tableName, schema);
        return schema;
    }

    /* Generic alias (for ACL/DATA); preserves existing cache + logic */
    private async getKeySchema(tableName: string) {
        return this.getAclKeySchema(tableName);
    }

    /* ======================== LIST ======================= */

    /* Lists tables in the current account/region */
    async listTables(cfg: Cfg | any): Promise<ListTablesCommandOutput> {
        this.ensureClients(cfg);
        return this.send<ListTablesCommandOutput>(
            this.getBase(),
            new ListTablesCommand({}),
            'ListTables'
        );
    }

    /* ======================== QUERY ====================== */

    /* ACL by worker identifier (GSI: identifier-index) */
    async getACLRecordWorkerId(
        cfg: Cfg | any,
        workerId: string,
        table?: string | null
    ): Promise<QueryCommandOutput> {
        const ncfg = this.ensureClients(cfg);
        return this.send<QueryCommandOutput>(
            this.getDoc(),
            new QueryCommand({
                TableName: table ?? ncfg.table_acl_name,
                IndexName: 'identifier-index',
                KeyConditionExpression: 'identifier = :identifier',
                ExpressionAttributeValues: {':identifier': workerId},
                ScanIndexForward: true
            }),
            'Query(ACL by identifier)'
        );
    }

    /* ACL by unit id (GSI: unit_id-index) */
    async getACLRecordUnitId(
        cfg: Cfg | any,
        unitId: string,
        table?: string | null
    ): Promise<QueryCommandOutput> {
        const ncfg = this.ensureClients(cfg);
        return this.send<QueryCommandOutput>(
            this.getDoc(),
            new QueryCommand({
                TableName: table ?? ncfg.table_acl_name,
                IndexName: 'unit_id-index',
                KeyConditionExpression: 'unit_id = :unit_id',
                ExpressionAttributeValues: {':unit_id': unitId},
                ScanIndexForward: true
            }),
            'Query(ACL by unit_id)'
        );
    }

    /* ACL by IP address (GSI: ip_address-index); returns empty page if IP unknown */
    async getACLRecordIpAddress(
        cfg: Cfg | any,
        ipAddress: string | { ip?: string },
        table?: string | null
    ): Promise<QueryCommandOutput> {
        const ncfg = this.ensureClients(cfg);
        const ip = typeof ipAddress === 'string' ? ipAddress : ipAddress?.ip;
        if (!ip) return {Items: []} as QueryCommandOutput;

        return this.send<QueryCommandOutput>(
            this.getDoc(),
            new QueryCommand({
                TableName: table ?? ncfg.table_acl_name,
                IndexName: 'ip_address-index',
                KeyConditionExpression: 'ip_address = :ip',
                ExpressionAttributeValues: {':ip': ip},
                ScanIndexForward: true
            }),
            'Query(ACL by ip_address)'
        );
    }

    /* ACL scan via unit_id index; locally sorted for deterministic processing */
    async scanACLRecordUnitId(
        cfg: Cfg | any,
        table?: string | null,
        lastEvaluatedKey: Record<string, unknown> | null = null,
        ascending = true
    ): Promise<ScanCommandOutput> {
        const ncfg = this.ensureClients(cfg);

        const page = await this.send<ScanCommandOutput>(
            this.getDoc(),
            new ScanCommand({
                TableName: table ?? ncfg.table_acl_name,
                IndexName: 'unit_id-index',
                ExclusiveStartKey: lastEvaluatedKey ?? undefined
            }),
            'Scan(ACL by unit_id-index)'
        );

        /* Stable sort by unit_id; do not mutate original Items reference in case callers depend on it */
        const items = (page.Items ?? []).slice().sort((a: any, b: any) => {
            const ua = String(a?.['unit_id'] ?? '');
                       const ub = String(b?.['unit_id'] ?? '');
            const cmp = ua.localeCompare(ub);
            return ascending ? cmp : -cmp;
        });
        (page as any).Items = items;

        return page;
    }

    /* Data records for a worker (partition = identifier) */
    async getDataRecord(
        cfg: Cfg | any,
        identifier: string,
        table?: string | null,
        lastEvaluatedKey: Record<string, unknown> | null = null
    ): Promise<QueryCommandOutput> {
        const ncfg = this.ensureClients(cfg);
        return this.send<QueryCommandOutput>(
            this.getDoc(),
            new QueryCommand({
                TableName: table ?? ncfg.table_data_name,
                KeyConditionExpression: '#id = :id',
                ExpressionAttributeNames: {'#id': 'identifier'},
                ExpressionAttributeValues: {':id': identifier},
                ExclusiveStartKey: lastEvaluatedKey ?? undefined
            }),
            'Query(Data by identifier)'
        );
    }

    /* =================== INSERT / PUT ==================== */

    /* Inserts an ACL row (uses Worker.paramsFetched as-is) */
    async insertACLRecordWorkerID(
        cfg: Cfg | any,
        worker: Worker
    ): Promise<PutCommandOutput> {
        const ncfg = this.ensureClients(cfg);
        return this.send<PutCommandOutput>(
            this.getDoc(),
            new PutCommand({
                TableName: ncfg.table_acl_name,
                Item: {...worker.paramsFetched}
            }),
            'Put(ACL by identifier)'
        );
    }

    /*
     * UPDATE-first ACL write (non-destructive) with runtime key discovery.
     * - Discovers real PK/SK and builds correct Key
     * - De-overlaps document paths in SET (e.g., "ua" vs "ua.source")
     * - Skips UPDATE if key fields missing; falls back to full PUT
     * Returns which path was used: 'update' or 'put'
     */
    async updateWorkerAcl(
        env: Cfg | any,
        worker: Worker,
        statusCode?: StatusCodes,
        extra?: Record<string, any>
    ): Promise<'update' | 'put'> {
        const ncfg = this.ensureClients(env);

        /* Merge optional fields into paramsFetched */
        if (statusCode !== undefined && statusCode !== null) {
            worker.setParameter('status_code', statusCode);
        }
        if (extra) {
            for (const [k, v] of Object.entries(extra)) {
                worker.setParameter(k, v as any);
            }
        }

        /* Discover table key schema and attribute types */
        const {pk, sk, types} = await this.getAclKeySchema(ncfg.table_acl_name);

        /* Build UpdateItem key; if incomplete, fallback to PUT */
        const pkValRaw = (worker.paramsFetched as any)?.[pk];
        const skValRaw = sk ? (worker.paramsFetched as any)?.[sk] : undefined;
        if (pkValRaw === undefined || (sk && skValRaw === undefined)) {
            await this.insertACLRecordWorkerID(ncfg, worker);
            return 'put';
        }

        /* Coerce key types to match table definitions */
        const coerceKey = (name: string, v: any) => {
            const t = types[name];
            if (t === 'N') return typeof v === 'number' ? v : Number(v);
            if (t === 'S') return typeof v === 'string' ? v : String(v);
            return v; /* 'B' assumed provided as binary */
        };
        const key: Record<string, any> = {[pk]: coerceKey(pk, pkValRaw)};
        if (sk) key[sk] = coerceKey(sk, skValRaw);

        /* Collect update candidates: skip PK/SK and 'time_update' (set explicitly) */
        const rawEntries = Object.entries(worker.paramsFetched ?? {})
            .filter(([k]) => k !== pk && k !== sk && k !== 'time_update');

        /* De-duplicate by attribute path (keep last occurrence) */
        const byKey = new Map<string, any>(rawEntries);

        /* De-overlap: if we set 'a', skip 'a.b'/'a.b.c' etc. */
        const keys = Array.from(byKey.keys()).sort(
            (a, b) => this.splitPath(a).length - this.splitPath(b).length
        );
        const kept: string[] = [];
        for (const k of keys) {
            if (kept.some(p => this.isPrefixPath(p, k))) continue;
            kept.push(k);
        }
        const updates: Array<[string, any]> = kept.map(k => [k, byKey.get(k)]);

        /* Build UpdateExpression: SET time_update = :now, plus each path safely tokenized */
        const names: Record<string, string> = {'#time_update': 'time_update'};
        const values: Record<string, any> = {':now': new Date().toUTCString()};
        const sets: string[] = ['#time_update = :now'];

        let nameTok = 0;
        let valTok = 0;

        for (const [attrPath, val] of updates) {
            /* Split dotted path into tokens: user_agent.source -> #n0.#n1 */
            const segs = this.splitPath(attrPath);
            const tokens: string[] = [];
            for (const s of segs) {
                const tn = `#n${nameTok++}`;
                names[tn] = s;
                tokens.push(tn);
            }
            const pathExpr = tokens.join('.');
            const vv = `:v${valTok++}`;
            values[vv] = val;
            sets.push(`${pathExpr} = ${vv}`);
        }

        try {
            await this.send<UpdateCommandOutput>(
                this.getDoc(),
                new UpdateCommand({
                    TableName: ncfg.table_acl_name,
                    Key: key,
                    UpdateExpression: 'SET ' + sets.join(', '),
                    ExpressionAttributeNames: names,
                    ExpressionAttributeValues: values
                }),
                'Update(ACL by key)'
            );
            return 'update';
        } catch {
            /* If IAM/conditional/schema issues arise, fallback to full PUT */
            await this.insertACLRecordWorkerID(ncfg, worker);
            return 'put';
        }
    }

    /*
     * Insert/update ACL row keyed by unit_id
     * - updateArrivalTime: bumps time_arrival + increments access_counter
     * - updateRemovalTime: bumps time_removal
     */
    async insertACLRecordUnitId(
        cfg: Cfg | any,
        entry: Record<string, any>,
        _currentTry: number,
        updateArrivalTime = false,
        updateRemovalTime = false
    ): Promise<PutCommandOutput> {
        const ncfg = this.ensureClients(cfg);

        const now = new Date().toUTCString();
        const item = {...entry};

        if (updateArrivalTime) {
            item['time_arrival'] = now;
            const counter = parseInt(item['access_counter'] ?? '0', 10) + 1;
            item['access_counter'] = counter.toString();
        }

        if (updateRemovalTime) {
            item['time_removal'] = now;
        }

        return this.send<PutCommandOutput>(
            this.getDoc(),
            new PutCommand({
                TableName: ncfg.table_acl_name,
                Item: item
            }),
            'Put(ACL by unit_id)'
        );
    }

    /*
     * Writes a task data record for a worker.
     * - Composite sequence: identifier-ip-unit-try-seqNumber
     * - Increments task.sequenceNumber unless sameSeq is true
     * - Stores full payload JSON in 'data'
     */
    async insertDataRecord(
        cfg: Cfg | any,
        worker: Worker,
        task: Task,
        data: Record<string, any>,
        sameSeq = false
    ): Promise<PutCommandOutput> {
        const ncfg = this.ensureClients(cfg);

        const rawIp = worker.getIP() as any;
        const ip = (typeof rawIp === 'string' ? rawIp : rawIp?.ip) ?? 'unknown';

        const seqBase = `${worker.identifier}-${ip}-${task.unitId}-${task.tryCurrent}`;
        const sequence = `${seqBase}-${task.sequenceNumber}`;

        /* Flatten 'info' fields; avoid clashing with the 'sequence' attribute */
        const infoItem = Object.entries(data['info'] ?? {}).reduce(
            (acc, [k, v]) => {
                if (k === 'sequence') return {...acc, sequence_number: String(v)};
                return {...acc, [k]: String(v)};
            },
            {}
        );

        const item: Record<string, any> = {
            identifier: worker.identifier,
            sequence,
            time: new Date().toUTCString(),
            data: JSON.stringify(data),
            ...infoItem
        };

        const res = await this.send<PutCommandOutput>(
            this.getDoc(),
            new PutCommand({
                TableName: ncfg.table_data_name,
                Item: item
            }),
            'Put(Data record)'
        );

        if (!sameSeq) {
            task.sequenceNumber += 1;
        }

        return res;
    }

    /* =================== UTILS / CLAIM =================== */

    /* A row is "active unpaid" if in_progress=true and paid=false */
    private isActiveUnpaid(it: any): boolean {
        const inProg = String(it?.['in_progress'] ?? '').toLowerCase() === 'true';
        const paid = String(it?.['paid'] ?? '').toLowerCase() === 'true';
        return inProg && !paid;
    }

    /*
     * Tries to claim a unit if no active unpaid holder exists:
     *  1) Query current holders
     *  2) Tentative put (arrival time + counter++)
     *  3) Post-verify; if contention > 1, deterministically elect a winner and yield if we lost
     *
     * Notes:
     * - No new tables or transactions: relies on best-effort convergence.
     * - Deterministic winner: earliest time_arrival, tie-break by identifier (lexicographic).
     * - Ensures only ONE active unpaid holder survives the race shortly after post-verify.
     * - Adds a tiny settle loop to reduce GSI lag effects (GSIs are eventually consistent).
     *
     * Claim marker (`claim_marker`) — how to interpret it:
     * - What it is: a per-attempt, best-effort unique stamp (e.g., "1697042234123_k9t3…") written with the tentative PUT.
     * - Why it exists: for debugging and post-mortem analytics to correlate which tentative write belonged to which app run.
     * - How to read it: just treat it as an opaque string; newer values do NOT imply stronger precedence.
     * - What it is NOT: not used in the winner election (we always elect by earliest time_arrival, then by identifier).
     * - Caller expectations (minimum fields to avoid downstream crashes):
     *     unitEntry should include at least:
     *       - unit_id, token_input, token_output
     *       - identifier, ip_address
     *       - in_progress="true", paid="false"
     *       - time_arrival (will be set if updateArrivalTime=true)
     *       - (optional but recommended for tooling): task_name, batch_name, user_agent
     */
    async claimUnitIfUnassigned(
        cfg: Cfg | any,
        unitEntry: Record<string, any>
    ): Promise<{ claimed: boolean, winner?: string }> {
        const ncfg = this.ensureClients(cfg);
        const unitId = unitEntry['unit_id'];

        /* 1) Pre-check existing holders */
        const pre = await this.getACLRecordUnitId(ncfg, unitId);
        const preItems = pre?.Items ?? [];
        if (preItems.some(it => this.isActiveUnpaid(it))) {
            return {claimed: false, winner: String(preItems.find(it => this.isActiveUnpaid(it))?.["identifier"] ?? '')};
        }

        /* 2) Tentative claim (arrival time bump + access counter) */
        unitEntry['claim_marker'] = unitEntry['claim_marker'] ?? `${Date.now()}_${Math.random().toString(36).slice(2)}`;

        await this.insertACLRecordUnitId(
            ncfg,
            unitEntry,
            0 /* _currentTry */,
            true /* updateArrivalTime */,
            false /* updateRemovalTime */
        );

        /* Helper: safe RFC date parse for ordering */
        const parseUtc = (s: any) => {
            const t = Date.parse(String(s ?? ''));
            return Number.isFinite(t) ? t : Number.MAX_SAFE_INTEGER;
        };

        /* Tiny settle loop to let GSI catch up (GSIs are eventually consistent). */
        const settle = async (ms: number) => new Promise(res => setTimeout(res, ms));

        for (let attempt = 0; attempt < 3; attempt++) {
            const post = await this.getACLRecordUnitId(ncfg, unitId);
            const items = post?.Items ?? [];
            const activeHolders = items.filter(it => this.isActiveUnpaid(it));

            if (activeHolders.length <= 1) {
                /* We are the only active unpaid holder (or none due to eventual read) */
                return {claimed: true};
            }

            /* Deterministic election: earliest time_arrival; tie-break on identifier */
            activeHolders.sort((a, b) => {
                const ta = parseUtc(a?.["time_arrival"]);
                const tb = parseUtc(b?.["time_arrival"]);
                if (ta !== tb) return ta - tb;
                const ia = String(a?.["identifier"] ?? '');
                const ib = String(b?.["identifier"] ?? '');
                return ia.localeCompare(ib);
            });
            const winnerId = String(activeHolders[0]?.["identifier"] ?? '');

            if (winnerId === String(unitEntry?.['identifier'])) {
                /* We won the election → keep the claim */
                return {claimed: true, winner: winnerId};
            }

            /* First two passes: short backoff to allow concurrent losers to yield */
            if (attempt < 2) {
                await settle(75); // ~75ms backoff; tune if needed
                continue;
            }

            /* Last pass: we lost → yield immediately: set own row inactive and set removal time */
            const yielded = {
                ...unitEntry,
                in_progress: String(false),
                time_removal: new Date().toUTCString()
            };
            await this.insertACLRecordUnitId(ncfg, yielded, 0, false, true);
            return {claimed: false, winner: winnerId};
        }

        /* Fallback (should not happen): treat as lost */
        return {claimed: false};
    }


    /* =================== ADMIN: GENERIC TABLE HELPERS =================== */

    /**
     * Scan ACL/DATA table with pagination.
     * - `logical`: 'ACL' | 'DATA'
     * - `limit`: page size
     * - `startKey`: ExclusiveStartKey from previous page
     */
    async scanTable(
        cfg: Cfg | any,
        logical: 'ACL' | 'DATA',
        limit = 50,
        startKey?: Record<string, any>
    ): Promise<{ Items: any[]; LastEvaluatedKey?: Record<string, any> }> {
        const ncfg = this.ensureClients(cfg);
        const TableName = logical === 'ACL' ? ncfg.table_acl_name : ncfg.table_data_name;

        const out = await this.send<ScanCommandOutput>(
            this.getDoc(),
            new ScanCommand({
                TableName,
                Limit: limit,
                ExclusiveStartKey: startKey
            }),
            `Scan(${logical})`
        );

        return {
            Items: out.Items ?? [],
            LastEvaluatedKey: out.LastEvaluatedKey
        };
    }

    /**
     * Put/upsert an item into ACL/DATA.
     * Full-document replace; keys must be present in `item`.
     */
    async putItemToTable(
        cfg: Cfg | any,
        logical: 'ACL' | 'DATA',
        item: any
    ): Promise<PutCommandOutput> {
        const ncfg = this.ensureClients(cfg);
        const TableName = logical === 'ACL' ? ncfg.table_acl_name : ncfg.table_data_name;
        return this.send<PutCommandOutput>(
            this.getDoc(),
            new PutCommand({TableName, Item: item}),
            `Put(${logical})`
        );
    }

    /**
     * Delete an item from ACL/DATA by deriving the Key from the table schema.
     * - Reads PK/SK from DescribeTable (cached)
     * - Coerces key value types to match attribute definitions (S/N/B)
     */
    async deleteItemFromTable(
        cfg: Cfg | any,
        logical: 'ACL' | 'DATA',
        item: any
    ): Promise<DeleteCommandOutput> {
        const ncfg = this.ensureClients(cfg);
        const TableName = logical === 'ACL' ? ncfg.table_acl_name : ncfg.table_data_name;

        const {pk, sk, types} = await this.getKeySchema(TableName);

        const coerce = (name: string, v: any) => {
            const t = types[name];
            if (t === 'N') return typeof v === 'number' ? v : Number(v);
            if (t === 'S') return typeof v === 'string' ? v : String(v);
            return v; /* 'B' assumed provided as Uint8Array/Buffer */
        };

        if (!(pk in item)) throw new Error(`Cannot delete: missing PK "${pk}" in item`);
        const Key: Record<string, any> = {[pk]: coerce(pk, item[pk])};
        if (sk) {
            if (!(sk in item)) throw new Error(`Cannot delete: missing SK "${sk}" in item`);
            Key[sk] = coerce(sk, item[sk]);
        }

        return this.send<DeleteCommandOutput>(
            this.getDoc(),
            new DeleteCommand({TableName, Key}),
            `Delete(${logical})`
        );
    }

    /* =================== PRIVATE HELPERS =================== */

    /* Splits a dotted document path into segments (ignores empty parts) */
    private splitPath(k: string): string[] {
        return String(k).split('.').filter(Boolean);
    }

    /* Returns true if `parent` is equal to or a strict prefix of `child` path */
    private isPrefixPath(parent: string, child: string): boolean {
        if (parent === child) return true;
        const p = this.splitPath(parent);
        const c = this.splitPath(child);
        if (p.length >= c.length) return false;
        for (let i = 0; i < p.length; i++) {
            if (p[i] !== c[i]) return false;
        }
        return true;
    }
}
