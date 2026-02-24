import path from "path";
import SQLite3 from "better-sqlite3";
import config from "../../config.json" with { type: "json" };
import { DatabaseOperator } from "../depend/database/operator.js";

const root = path.resolve(".");

export const environment = process.env.NODE_ENV || "development";

/** @type { { filepath: string, schema: string } } */
export const self = config.databases[environment];

export const filepath = path.join(
    root, self.filepath
);

export const instance = new SQLite3(filepath, {
    "timeout": 5000, "readonly": false
});

export const operator = new DatabaseOperator(instance);