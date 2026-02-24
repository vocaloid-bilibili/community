import template from "../depend/template.js";
import { depend as gepend } from "../general.js";
import { quote_string as quote } from "../depend/base.js";

function build_where(check) {
    const build = gepend.build;

    const parameter = {};

    const setter = gepend.inner.setter(parameter);

    const replacer = (_, key) => {
        return parameter[key];
    };

    const where = build.where(
        check, setter
    ).replaceAll(
        /:(Value_\d+)/g, replacer
    );

    return where;
}

function build_foreign(table, column, action) {
    const suffix = [];

    const _push = (value) => {
        const mapping = {
            "cascade": "CASCADE",
            "set-null": "SET NULL",
            "set-default": "SET DEFAULT",
            "no-action": "NO ACTION",
            "restrict": "RESTRICT"
        };

        const item = mapping[value];
        
        if (item !== undefined) {
            suffix.push(item);
        }

        return item;
    };

    if (action.delete) {
        suffix.push("ON DELETE");

        _push(action.delete)
    }

    if (action.update) {
        suffix.push("ON UPDATE");

        _push(action.update);
    }

    if (!Array.isArray(column)) {
        column = [ column ];
    }

    const pack = gepend.build.tuple_literal;

    const result = template.replace(
        `REFERENCES {{table}}{{column}}{{suffix}}`, {
            "table": quote(table, "double"),
            "column": pack(column.map(
                item => quote(item, "double")
            ), true),
            "suffix": suffix.length > 0 ?
                " " + suffix.join(" ") : ""
        }
    );

    return result;
}

const inner = {
    "parse": {
        plain(value) {
            const type = typeof value;

            if (type === "string") {
                return quote(value, "single");
            } else {
                return value.toString();
            }
        },

        column(options) {
            const parts = [];

            const { type, name } = options;

            parts.push(quote(
                name, "double"
            ));

            parts.push(
                type.toUpperCase()
            );

            const { flags = [] } = options;

            if (flags.includes("unique")) {
                parts.push("UNIQUE");
            }

            if (flags.includes("not-null")) {
                parts.push("NOT NULL");
            }

            if (flags.includes("primary-key")) {
                parts.push("PRIMARY KEY");
            }

            if (flags.includes("auto-increment")) {
                parts.push("AUTOINCREMENT");
            }

            if ("default" in options) {
                let value = options.default;

                const mapping = {
                    "::current:now::": "CURRENT_TIMESTAMP",
                    "::current:date::": "CURRENT_DATE",
                    "::current:time::": "CURRENT_TIME",
                };

                if (mapping[value]) {
                    value = mapping[value];
                } else {
                    value = this.plain(
                        options.default
                    );
                }

                parts.push("DEFAULT " + value);
            }

            if (options.check) {
                const where = build_where(
                    options.check || {}
                );

                parts.push("CHECK " + where);
            }

            if (options.collate) {
                const mapping = {
                    "binary": "BINARY",
                    "no-case": "NOCASE",
                };

                const mode = mapping[
                    options.collate.toLowerCase()
                ];

                parts.push("COLLATE " + mode);
            }

            if (options.foreign) {
                const foreign = options.foreign;

                const table = foreign.table;
                const column = foreign.column;
                const action = foreign.action || {};

                parts.push(build_foreign(
                    table, column, action
                ));
            }

            return parts.join(" ");
        }
    }
};

const indent = 4;

/**
 * 创建新的表单
 * 
 * @param {string} table 新建的表单名称
 * @param {object} options 表单的配置信息
 * @returns 执行结果
 */
export function create(table, options) {
    const { flags = [] } = options;

    const statement = [];

    statement.push("CREATE");

    if (flags.includes("temporary")) {
        statement.push("TEMPORARY");
    }

    statement.push("TABLE");

    if (flags.includes("if-not-exists")) {
        statement.push("IF NOT EXISTS");
    }

    const parts = [];

    const parse = inner.parse;
    const list = options.column;

    for (let index = 0; index < list.length; index++) {
        const column = list[index];

        parts.push(
            parse.column(column)
        );
    }

    const getter = gepend.inner.getter();

    const pad_number = (number, length = 3) => {
        const text = number.toString();

        return text.padStart(length, "0");
    };

    if (options.restrict) {
        const restrict = options.restrict;

        let { check, foreign } = restrict;
        let { unique, primary } = restrict;

        const pack = gepend.build.tuple_literal;

        const namer = () =>
            "C_" + pad_number(getter(), 4);

        const prefixer = (name) => {
            if (!name) return "";

            name = quote(name, "double");

            return `CONSTRAINT ${name} `;
        };

        const columner = (column, packet = true) => {
            if (!Array.isArray(column)) {
                column = [ column ];
            }

            const list = column.map(
                name => quote(name, "double")
            );

            const result = pack(list, packet);

            return result;
        }

        if (primary) {
            if (typeof primary === "string") {
                primary = {
                    "name": namer(),
                    "column": primary
                };
            }
            
            const { name, column } = primary;

            const prefix = prefixer(name);
            const suffix = columner(column);

            parts.push(`${prefix}PRIMARY KEY ${suffix}`);
        }

        if (unique) {
            if (!Array.isArray(unique)) {
                unique = [ unique ];
            }
            
            for (let index = 0; index < unique.length; index++) {
                let current = unique[index];

                if (typeof current === "string") {
                    current = {
                        "name": namer(),
                        "column": current
                    };
                }

                const { name, column } = current;

                const prefix = prefixer(name);
                const suffix = columner(column);

                parts.push(`${prefix}UNIQUE ${suffix}`);
            }
        }

        if (check) {
            if (!Array.isArray(check)) {
                check = [ check ];
            }

            for (let index = 0; index < check.length; index++) {
                let current = check[index];

                if (typeof current === "string") {
                    current = {
                        "name": namer(),
                        "where": current
                    };
                }

                const { name, where } = current;
 
                const prefix = prefixer(name);
                const suffix = build_where(where);

                parts.push(`${prefix}CHECK (${suffix})`);
            }
        }

        if (foreign) {
            if (!Array.isArray(foreign)) {
                foreign = [ foreign ];
            }

            for (let index = 0; index < foreign.length; index++) {
                let current = foreign[index];

                current.name ??= namer();

                const { name, table, column, action } = current;

                const prefix = prefixer(name);
                const suffix = build_foreign(
                    table, column.target, action
                );

                const middle = `FOREIGN KEY ${
                    columner(column.source)
                }`;

                parts.push(`${prefix}${middle}${suffix}`);
            }
        }
    }

    const sentence = template.replace(
        "{{statement}} {{table}} (\n{{column}}\n)", {
            "table": quote(table, "double"),
            "column": parts.map(part => {
                return " ".repeat(indent) + part;
            }).join(",\n"),
            "statement": statement.join(" ")
        }
    );

    return {
        "action": "request",
        "sentence": sentence,
        "parameter": {}
    };
}

/**
 * 删除现有表单
 * 
 * @param {string} table 需要删除的表单的名称
 * @param {object} options 删除表单时使用的配置
 * @returns 执行结果
 */
export function remove(table, options) {
    const { flags = [] } = options;
    
    const statement = [];
    
    statement.push("DROP TABLE");
    
    if (flags.includes("if-exists")) {
        statement.push("IF EXISTS");
    }
    
    const sentence = template.replace(
        "{{statement}} {{table}}", {
            "table": quote(table, "double"),
            "statement": statement.join(" ")
        }
    );
    
    return {
        "action": "request",
        "sentence": sentence,
        "parameter": {}
    };
}

/**
 * 更改现有表单的结构
 * 
 * @param {string} table 需要更改结构的表单名称
 * @param {object} options 修改结构的配置信息
 * @returns 执行结果
 */
export function alter(table, options) {
    const { action } = options;

    const statement = [];

    statement.push("ALTER TABLE");

    statement.push(
        quote(table, "double")
    );

    if (action === "add-column") {
        statement.push("ADD COLUMN");

        const parse = inner.parse;

        statement.push(
            parse.column(options.column)
        );
    }

    if (action === "drop-column") {
        statement.push("DROP COLUMN");

        statement.push(
            quote(options.column, "double")
        );
    }

    if (action === "rename-column") {
        statement.push("RENAME COLUMN");

        const column = options.column;

        statement.push(
            quote(column.old, "double")
        );

        statement.push("TO");

        statement.push(
            quote(column.new, "double")
        );
    }

    if (action === "rename-table") {
        statement.push("RENAME TO");

        statement.push(
            quote(options.table, "double")
        );
    }

    const sentence = statement.join(" ");

    return {
        "action": "request",
        "sentence": sentence,
        "parameter": {}
    };
}