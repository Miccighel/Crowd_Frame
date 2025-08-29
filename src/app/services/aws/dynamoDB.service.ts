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
    PutCommand
} from '@aws-sdk/lib-dynamodb';

/* ---------- Domain models ---------- */
import {Worker} from '../../models/worker/worker';
import {Task} from '../../models/skeleton/task';

@Injectable({providedIn: 'root'})
export class DynamoDBService {

    /* ================== CLIENT BUILDERS ================== */

    /**
     * Builds a low-level DynamoDBClient.
     * Note: rarely used directly; the DocumentClient is preferred.
     */
    private baseClient(cfg) {
        return new DynamoDBClient({
            region: cfg.region,
            credentials: {
                accessKeyId: cfg.aws_id_key,
                secretAccessKey: cfg.aws_secret_key
            }
        });
    }

    /**
     * Builds a DynamoDBDocumentClient with transparent marshalling.
     */
    private docClient(cfg) {
        return DynamoDBDocumentClient.from(this.baseClient(cfg));
    }

    /* ======================== LIST ======================= */

    /**
     * Lists DynamoDB tables for the configured account/region.
     * Used to locate previous-batch ACL tables precisely.
     */
    async listTables(cfg) {
        const client = this.baseClient(cfg);
        return client.send(new ListTablesCommand({}));
    }

    /* ======================== QUERY ====================== */

    /**
     * Queries the ACL table by worker identifier (GSI: identifier-index).
     */
    async getACLRecordWorkerId(cfg, workerId, table: string = null) {
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
    async getACLRecordUnitId(cfg, unitId, table: string = null) {
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
     */
    async getACLRecordIpAddress(cfg, ipAddress, table: string = null) {
        const client = this.docClient(cfg);
        const ip =
            typeof ipAddress === 'string'
                ? ipAddress
                : (ipAddress && typeof ipAddress === 'object' && ipAddress.ip) || undefined;

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
        cfg,
        table: string = null,
        lastEvaluatedKey: Record<string, unknown> = null,
        ascending = true
    ) {
        const client = this.docClient(cfg);
        const page = await client.send(new ScanCommand({
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
        cfg,
        identifier,
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
    async insertACLRecordWorkerID(cfg, worker: Worker) {
        const client = this.docClient(cfg);
        return client.send(new PutCommand({
            TableName: cfg.table_acl_name,
            Item: {...worker.paramsFetched}
        }));
    }

    /**
     * Inserts or updates an ACL row keyed by `unit_id`.
     * Optional flags:
     *  - updateArrivalTime: bumps `time_arrival` and increments `access_counter`.
     *  - updateRemovalTime: bumps `time_removal`.
     * Semantics are preserved.
     */
    async insertACLRecordUnitId(
        cfg,
        entry: Record<string, string>,
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
     */
    async insertDataRecord(
        cfg,
        worker: Worker,
        task: Task,
        data: Record<string, any>,
        sameSeq = false
    ) {
        const ip = (worker.getIP() as { ip: string | null }).ip ?? 'unknown';
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
            data: JSON.stringify(data),
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

    /**
     * Detects ConditionalCheckFailed errors (SDK v3) in a tolerant way.
     */
    isConditionalCheckFailed(err: any): boolean {
        return (
            err?.name === 'ConditionalCheckFailedException' ||
            err?.code === 'ConditionalCheckFailedException' ||
            /ConditionalCheckFailed/i.test(err?.message ?? '')
        );
    }

    /**
     * Attempts to claim a unit if no active unpaid holder exists.
     * Best-effort approach without schema changes:
     *  - Queries by `unit_id` (GSI).
     *  - If no active holder is found, writes a row for the caller.
     *  - A concurrent winner may still occur between query and put.
     */
    async claimUnitIfUnassigned(cfg, unitEntry: Record<string, any>): Promise<{ claimed: boolean }> {
        const page = await this.getACLRecordUnitId(cfg, unitEntry['unit_id']);
        const items = page?.Items ?? [];

        const taken = items.some(it => {
            const inProg = String(it?.['in_progress'] ?? '').toLowerCase() === 'true';
            const paid = String(it?.['paid'] ?? '').toLowerCase() === 'true';
            return inProg && !paid;
        });

        if (taken) return {claimed: false};

        await this.insertACLRecordUnitId(cfg, unitEntry, /* _currentTry */ 0, /* updateArrival */ true, /* updateRemoval */ false);
        return {claimed: true};
    }

}
