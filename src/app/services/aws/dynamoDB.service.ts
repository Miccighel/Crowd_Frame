import {Injectable} from '@angular/core';

/* ---------- AWS SDK v3 ---------- */
import {
    DynamoDBClient,
    ListTablesCommand
} from '@aws-sdk/client-dynamodb';
import {
    DynamoDBDocumentClient,
    QueryCommand,
    ScanCommand,
    PutCommand,
    UpdateCommand
} from '@aws-sdk/lib-dynamodb';

/* ---------- Domain models ---------- */
import {Worker} from '../../models/worker/worker';
import {Task} from '../../models/skeleton/task';
import {StatusCodes} from '../section.service';

type Cfg = {
    region: string;
    aws_id_key: string;
    aws_secret_key: string;
    table_acl_name: string;
    table_data_name: string;
};

@Injectable({providedIn: 'root'})
export class DynamoDBService {

    /* ================== CLIENT BUILDERS ================== */
    private _base?: DynamoDBClient;           /* cached per-app */
    private _doc?: DynamoDBDocumentClient;    /* cached per-app */

    /**
     * Builds a low-level DynamoDBClient (cached).
     */
    private baseClient(cfg: Cfg) {
        if (!this._base) {
            this._base = new DynamoDBClient({
                region: cfg.region,
                credentials: {
                    accessKeyId: cfg.aws_id_key,
                    secretAccessKey: cfg.aws_secret_key
                }
            });
        }
        return this._base;
    }

    /**
     * Builds a DynamoDBDocumentClient with transparent marshalling (cached).
     */
    private docClient(cfg: Cfg) {
        if (!this._doc) {
            this._doc = DynamoDBDocumentClient.from(this.baseClient(cfg));
        }
        return this._doc;
    }

    /* ======================== LIST ======================= */

    /**
     * Lists DynamoDB tables for the configured account/region.
     * Used to locate previous-batch ACL tables precisely.
     */
    async listTables(cfg: Cfg) {
        const client = this.baseClient(cfg);
        return client.send(new ListTablesCommand({}));
    }

    /* ======================== QUERY ====================== */

    /**
     * Queries the ACL table by worker identifier (GSI: identifier-index).
     */
    async getACLRecordWorkerId(cfg: Cfg, workerId: string, table: string = null) {
        const client = this.docClient(cfg);
        return client.send(new QueryCommand({
            TableName: table ?? cfg.table_acl_name,
            IndexName: 'identifier-index',
            KeyConditionExpression: 'identifier = :identifier',
            ExpressionAttributeValues: {':identifier': workerId},
            ScanIndexForward: true
        }));
    }

    /**
     * Queries the ACL table by unit id (GSI: unit_id-index).
     */
    async getACLRecordUnitId(cfg: Cfg, unitId: string, table: string = null) {
        const client = this.docClient(cfg);
        return client.send(new QueryCommand({
            TableName: table ?? cfg.table_acl_name,
            IndexName: 'unit_id-index',
            KeyConditionExpression: 'unit_id = :unit_id',
            ExpressionAttributeValues: {':unit_id': unitId},
            ScanIndexForward: true
        }));
    }

    /**
     * Queries the ACL table by IP address (GSI: ip_address-index).
     * Accepts a string IP or an object with an `ip` field to avoid shape issues.
     * Returns an empty page if IP cannot be resolved (no throw).
     */
    async getACLRecordIpAddress(cfg: Cfg, ipAddress: string | { ip?: string }, table: string = null) {
        const client = this.docClient(cfg);
        const ip =
            typeof ipAddress === 'string'
                ? ipAddress
                : (ipAddress && typeof ipAddress === 'object' && ipAddress.ip) || undefined;

        if (!ip) return {Items: []};

        return client.send(new QueryCommand({
            TableName: table ?? cfg.table_acl_name,
            IndexName: 'ip_address-index',
            KeyConditionExpression: 'ip_address = :ip',
            ExpressionAttributeValues: {':ip': ip},
            ScanIndexForward: true
        }));
    }

    /**
     * Scans the ACL table via the unit_id index.
     * Results are locally sorted for deterministic processing.
     */
    async scanACLRecordUnitId(
        cfg: Cfg,
        table: string = null,
        lastEvaluatedKey: Record<string, unknown> = null,
        ascending = true
    ) {
        const client = this.docClient(cfg);
        const page: any = await client.send(new ScanCommand({
            TableName: table ?? cfg.table_acl_name,
            IndexName: 'unit_id-index',
            ExclusiveStartKey: lastEvaluatedKey ?? undefined
        }));

        // Local sort by unit_id; callers may re-sort by time fields as needed.
        page.Items = (page.Items ?? []).sort((a, b) => {
            const ua = String(a?.['unit_id'] ?? '');
            const ub = String(b?.['unit_id'] ?? '');
            const cmp = ua.localeCompare(ub);
            return ascending ? cmp : -cmp;
        });

        return page;
    }

    /**
     * Queries the data table partition for a worker (paged).
     */
    async getDataRecord(
        cfg: Cfg,
        identifier: string,
        table: string = null,
        lastEvaluatedKey: Record<string, unknown> = null
    ) {
        const client = this.docClient(cfg);
        return client.send(new QueryCommand({
            TableName: table ?? cfg.table_data_name,
            KeyConditionExpression: '#id = :id',
            ExpressionAttributeNames: {'#id': 'identifier'},
            ExpressionAttributeValues: {':id': identifier},
            ExclusiveStartKey: lastEvaluatedKey ?? undefined
        }));
    }

    /* =================== INSERT / PUT ==================== */

    /**
     * Inserts an ACL row for the worker using Worker.paramsFetched.
     */
    async insertACLRecordWorkerID(cfg: Cfg, worker: Worker) {
        const client = this.docClient(cfg);
        return client.send(new PutCommand({
            TableName: cfg.table_acl_name,
            Item: {...worker.paramsFetched}
        }));
    }

    /**
     * Non-destructive ACL update when possible; falls back to full PUT.
     * If your ACL PK isn't {identifier}, the UPDATE may fail and we fall back.
     */
    async updateWorkerAcl(env: Cfg, worker: Worker, statusCode?: StatusCodes, extra?: Record<string, any>) {
        if (statusCode !== undefined && statusCode !== null) {
            worker.setParameter('status_code', statusCode);
        }
        if (extra) {
            Object.entries(extra).forEach(([k, v]) => worker.setParameter(k, v as any));
        }

        try {
            const names: Record<string, string> = {'#time_update': 'time_update'};
            const values: Record<string, any> = {':now': new Date().toUTCString()};
            const sets: string[] = ['#time_update = :now'];

            let i = 0;
            for (const [k, v] of Object.entries(worker.paramsFetched)) {
                if (k === 'identifier') continue; // PK, do not set
                const nk = `#k${i}`;
                const nv = `:v${i}`;
                names[nk] = k;
                values[nv] = v;
                sets.push(`${nk} = ${nv}`);
                i++;
            }

            await this.docClient(env).send(new UpdateCommand({
                TableName: env.table_acl_name,
                Key: {identifier: worker.identifier}, // adjust if your real PK differs
                UpdateExpression: 'SET ' + sets.join(', '),
                ExpressionAttributeNames: names,
                ExpressionAttributeValues: values
            }));
        } catch {
            // Fallback: if UPDATE fails (e.g., different PK schema), do a full PUT
            await this.insertACLRecordWorkerID(env, worker);
        }
    }

    /**
     * Inserts or updates an ACL row keyed by `unit_id`.
     * Optional flags:
     *  - updateArrivalTime: bumps `time_arrival` and increments `access_counter`.
     *  - updateRemovalTime: bumps `time_removal`.
     */
    async insertACLRecordUnitId(
        cfg: Cfg,
        entry: Record<string, any>,
        _currentTry: number,
        updateArrivalTime = false,
        updateRemovalTime = false
    ) {
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

        const client = this.docClient(cfg);
        return client.send(new PutCommand({
            TableName: cfg.table_acl_name,
            Item: item
        }));
    }

    /**
     * Writes a task data record for a worker.
     * Builds a composite sequence key `identifier-ip-unit-try-seqNumber`.
     * Increments `task.sequenceNumber` unless `sameSeq` is true.
     * (No payload trimming.)
     */
    async insertDataRecord(
        cfg: Cfg,
        worker: Worker,
        task: Task,
        data: Record<string, any>,
        sameSeq = false
    ) {
        const rawIp = worker.getIP() as any;
        const ip = (typeof rawIp === 'string' ? rawIp : rawIp?.ip) ?? 'unknown';

        const seqBase = `${worker.identifier}-${ip}-${task.unitId}-${task.tryCurrent}`;
        const sequence = `${seqBase}-${task.sequenceNumber}`;

        // Flatten info fields; protect against 'sequence' key collision.
        const infoItem = Object.entries(data['info'] ?? {}).reduce(
            (acc, [k, v]) => {
                if (k === 'sequence') {
                    return {...acc, sequence_number: String(v)};
                }
                return {...acc, [k]: String(v)};
            },
            {}
        );

        const item: Record<string, any> = {
            identifier: worker.identifier,
            sequence,
            time: new Date().toUTCString(),
            data: JSON.stringify(data),   // <-- not trimmed
            ...infoItem
        };

        const result = await this.docClient(cfg).send(new PutCommand({
            TableName: cfg.table_data_name,
            Item: item
        }));

        if (!sameSeq) {
            task.sequenceNumber += 1;
        }

        return result;
    }

    /* =================== UTILS / CLAIM =================== */

    /** True if entry is in-progress and not paid. */
    private isActiveUnpaid(it: any): boolean {
        const inProg = String(it?.['in_progress'] ?? '').toLowerCase() === 'true';
        const paid = String(it?.['paid'] ?? '').toLowerCase() === 'true';
        return inProg && !paid;
    }

    /**
     * Attempts to claim a unit if no active unpaid holder exists.
     * Best-effort approach without schema changes:
     *  1) Query current holders
     *  2) Write our row
     *  3) Post-verify; if contention > 1, yield our claim
     */
    async claimUnitIfUnassigned(cfg: Cfg, unitEntry: Record<string, any>): Promise<{ claimed: boolean }> {
        // 1) Pre-check existing holders
        const pre = await this.getACLRecordUnitId(cfg, unitEntry['unit_id']);
        const preItems = pre?.Items ?? [];
        if (preItems.some(it => this.isActiveUnpaid(it))) {
            return {claimed: false};
        }

        // 2) Tentative claim
        await this.insertACLRecordUnitId(
            cfg,
            unitEntry,
            /* _currentTry */ 0,
            /* updateArrivalTime */ true,
            /* updateRemovalTime */ false
        );

        // 3) Post-verify and yield if we lost a race
        const post = await this.getACLRecordUnitId(cfg, unitEntry['unit_id']);
        const postItems = post?.Items ?? [];
        const activeHolders = postItems.filter(it => this.isActiveUnpaid(it));

        if (activeHolders.length > 1) {
            const mine = activeHolders.find(x => x?.["identifier"] === unitEntry?.["identifier"]);
            if (mine) {
                const yielded = {...mine, in_progress: String(false), time_removal: new Date().toUTCString()};
                await this.insertACLRecordUnitId(cfg, yielded, 0, false, true);
            }
            return {claimed: false};
        }

        return {claimed: true};
    }

}
