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

    /* ------------------ CLIENT BUILDERS ------------------ */

    /** Low-level DynamoDBClient (rarely needed directly) */
    private baseClient(cfg) {
        return new DynamoDBClient({
            region: cfg.region,
            credentials: {
                accessKeyId: cfg.aws_id_key,
                secretAccessKey: cfg.aws_secret_key
            }
        });
    }

    /** DocumentClient with automatic marshalling ↔︎ plain JS */
    private docClient(cfg) {
        return DynamoDBDocumentClient.from(this.baseClient(cfg));
    }

    /* --------------------- LIST -------------------------- */

    async listTables(cfg) {
        const client = this.baseClient(cfg);
        return client.send(new ListTablesCommand({}));
    }

    /* --------------------- QUERY ------------------------- */

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

    async getACLRecordIpAddress(cfg, ipAddress, table: string = null) {
        const client = this.docClient(cfg);
        return client.send(new QueryCommand({
            TableName: table ?? cfg.table_acl_name,
            IndexName: 'ip_address-index',
            KeyConditionExpression: 'ip_address = :ip',
            ExpressionAttributeValues: {':ip': ipAddress.ip},
            ScanIndexForward: true
        }));
    }

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

        /* Local sort — adjust the field name if you need another column */
        page.Items = (page.Items ?? []).sort((a, b) => {
            const cmp = String(a.unit_id).localeCompare(String(b.unit_id));
            return ascending ? cmp : -cmp;
        });

        return page;
    }

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

    /* --------------------- INSERT / PUT ------------------ */

    /** Insert a full ACL record from `worker.paramsFetched` */
    async insertACLRecordWorkerID(cfg, worker: Worker) {
        const client = this.docClient(cfg);
        return client.send(new PutCommand({
            TableName: cfg.table_acl_name,
            Item: {...worker.paramsFetched}
        }));
    }

    /**
     * Insert or update an ACL record keyed on `unit_id`.
     * Flags let you bump arrival/removal timestamps and access counter.
     */
    async insertACLRecordUnitId(
        cfg,
        entry: Record<string, string>,
        currentTry: number,
        updateArrivalTime = false,
        updateRemovalTime = false
    ) {
        const now = new Date().toUTCString();
        const item = {...entry};

        if (updateArrivalTime) {
            item.time_arrival = now;
            const counter = parseInt(item.access_counter ?? '0', 10) + 1;
            item.access_counter = counter.toString();
        }

        if (updateRemovalTime) {
            item.time_removal = now;
        }

        const client = this.docClient(cfg);
        return client.send(new PutCommand({
            TableName: cfg.table_acl_name,
            Item: item
        }));
    }

    /**
     * Write task data for a worker.
     * Increments `task.sequenceNumber` unless `sameSeq` is true.
     */
    async insertDataRecord(
        cfg,
        worker: Worker,
        task: Task,
        data: Record<string, any>,
        sameSeq = false
    ) {
        /*  safely grab the IP */
        const ip = (worker.getIP() as { ip: string | null }).ip ?? 'unknown';

        /* build the composite sort-key */
        const seqBase = `${worker.identifier}-${ip}-${task.unitId}-${task.tryCurrent}`;
        const sequence = `${seqBase}-${task.sequenceNumber}`;

        /* flatten data.info, diverting ‘sequence’ → ‘sequence_number’ */
        const infoItem = Object.entries(data.info ?? {}).reduce(
            (acc, [k, v]) => {
                if (k === 'sequence') {
                    return {...acc, sequence_number: v.toString()};  // 👈 guard added
                }
                return {...acc, [k]: v.toString()};
            },
            {}
        );

        /* assemble the final item */
        const item: Record<string, any> = {
            identifier: worker.identifier,
            sequence,                         // composite string is safe
            time: new Date().toUTCString(),
            data: JSON.stringify(data),
            ...infoItem
        };

        /* write it */
        const result = await this.docClient(cfg).send(new PutCommand({
            TableName: cfg.table_data_name,
            Item: item
        }));

        /* 6️⃣  bump the running seq number unless caller overrides */
        if (!sameSeq) {
            task.sequenceNumber += 1;
        }

        return result;
    }

}
