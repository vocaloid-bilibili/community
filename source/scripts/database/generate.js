import fs from "fs";
import path from "path";
import { self, filepath, operator } from "../../database/toolkit.js";
import console from "../../depend/toolkit/console.js";
import * as parameter from "../../depend/utilities/sequence/parameter.js";

const root = path.resolve(".");
const shell = parameter.parse(
    process.argv.slice(2)
);

const schemas = [ JSON.parse(fs.readFileSync(
    path.join(root, self.schema), "UTF-8")) ];

for (let index = 0; index < schemas.length; index++) {
    const current = schemas[index];

    const { flags = [], targets, options } = current;

    console.tlog(`创建数据库: ${filepath}。`);

    if (flags.includes("enable-wal-mode")) {
        console.tlog("启用 WAL 模式。");

        operator.pragma().journal_mode.enable("wal");
    }

    const reviewer = (result) => {
        if (shell.debug === "true") {
            console.log(result[0]);
        }

        return result;
    };

    if (!targets || targets.includes("table")) {
        const table_list = options.tables;

        for (let index = 0; index < table_list.length; index++) {
            const table = table_list[index];

            if (table.enable === false) continue;
            
            operator.create_table(table.name, table.options, reviewer);

            const name_list = table.options.column.map(column => column.name);

            console.tlog(`  创建表单: ${table.name} (column: ${name_list.join(", ")})`);
        }

        console.log();
    }

    if (!targets || targets.includes("index")) {
        const index_list = options.indexes;

        for (let index = 0; index < index_list.length; index++) {
            const current = index_list[index];

            if (current.enable === false) continue;
            
            operator.create_index(
                current.table, current.name, current.options, reviewer
            );

            console.tlog(`  创建索引: ${current.name} (table: ${current.table},` +
                ` column: ${current.options.column.join(", ")})`);
        }

        console.log();
    }
}

console.tlog("数据库初始化完成。");