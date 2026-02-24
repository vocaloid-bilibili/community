import template from "../depend/template.js";
import { depend as gepend } from "../general.js";
import { quote_string as quote, split_group } from "../depend/base.js";

const inner = {
    "insert": {
        /**
         * 通过配置参数构建 statement 字段
         *  
         * @param {object} options 需要分析的配置参数
         * @returns 构建结果
         */
        build(options = {}) {
            const flag = options.flag || [];

            let statement = "INSERT";

            if (flag.some(i => i.includes("if"))) {
                statement += " OR";

                if (flag.includes("if-exists-ignore")) {
                    statement += " IGNORE";
                }

                if (flag.includes("if-exists-replace")) {
                    statement += " REPLACE";
                }
            }

            statement += " INTO";

            return { statement };
        }
    }
};

const depend = {
    "general": {
        /**
         * 将字符串数组以 SQL 数组的形式返回
         * 
         * @param {string[]} list 需要处理的字符串数组
         * @returns {string} 以 SQL 数组的形式返回的数组
         */
        list_pack: (list) => {
            return "( " + list.join(", ") + " )";
        }
    },

    "inner": {
        "holder": (setter, getter) => {
            return (value) => {
                const builder = gepend.build;

                return builder.placeholder(
                    value, getter(), setter
                );
            }
        },

        "returning": (fields = [], prefix = "") => {
            if (fields.length < 1) {
                return prefix;
            }

            if (fields === "all") {
                fields = [ "*" ];
            } else {
                fields = fields.map(field => 
                    quote(field, "double")
                );
            }

            const pack = gepend.build.tuple_literal;

            const suffix = pack(fields, false);

            return `${prefix}RETURNING ${suffix}`;
        },

        "column_quote": column => {
            return quote(column, "double");
        },
    }
};

export const insert = {
    /**
     * 插入记录到指定表单
     * 
     * @param {string} table 表单名称
     * @param {object} data 需要插入的记录的数据
     * @param {object} options 构建语句时使用的配置
     * @returns 插入结果
     */
    regular(table, data, options = {}) {
        const { action = "request" } = options; 

        const { statement } = inner.insert.build(options);

        const parameter = {};
        
        const getter = gepend.inner.getter();
        const setter = gepend.inner.setter(parameter);

        const list = {
            "value": [], "column": []
        };

        for (const [ key, value ] of Object.entries(data)) {
            list.column.push(
                quote(key, "double")
            );

            list.value.push(
                gepend.build.placeholder(
                    value, getter(), setter
                )
            );
        }

        const pack = gepend.build.tuple_literal;

        let sentence = template.replace(
            "{{statement}} {{table}} {{column}} VALUES {{value}}", {
                "statement": statement, "table": quote(table, "double"),
                "column": pack(list.column), "value": pack(list.value)
            }
        );
        
        if (options.return_field) {
            sentence += depend.inner.returning(
                options.return_field, " "
            );
        }

        return {
            "action": action,
            "sentence": sentence,
            "parameter": parameter
        };
    },

    /**
     * 批量插入项目到指定表单
     * 
     * @param {string} table 表单名称
     * @param {object[]} dataset 需要插入的记录的数据集
     * @param {object} options 构建语句时使用的配置
     */
    batch(table, dataset, options = {}) {
        const { scale = 64 } = options;

        const { action = "request" } = options;

        if (!dataset || dataset.length === 0) return; 

        const { statement } = inner.insert.build(options);

        const list = {
            "column": Object.keys(dataset[0]).map(
                name => quote(name, "double")
            )
        };

        const chunks = split_group(dataset, scale);

        const pack = gepend.build.tuple_literal;

        const result = [];

        for (let index = 0; index < chunks.length; index++) {
            const chunk = chunks[index], parameter = {};

            const getter = gepend.inner.getter();
            const setter = gepend.inner.setter(parameter);

            const values = [];

            for (let index = 0; index < chunk.length; index++) {
                const data = chunk[index], value_list = [];
                
                for (const [ _key, value ] of Object.entries(data)) {
                    value_list.push(
                        gepend.build.placeholder(
                            value, getter(), setter
                        )
                    );
                }

                values.push(value_list);
            }

            const position = Number(chunk.length !== scale);
            
            if (!result[position]) {
                let sentence = template.replace(
                    "{{statement}} {{table}} {{column}} VALUES {{value}}", {
                        "statement": statement, "table": quote(table, "double"),
                        "column": pack(list.column),
                        "value": values.map(value => pack(value)).join(", ")
                    }
                );

                if (options.return_field) {
                    sentence += depend.inner.returning(
                        options.return_field, " "
                    );
                }

                result[position] = {
                    "action": action,
                    "sentence": sentence,
                    "parameter": []
                };
            }

            result[position].parameter.push(parameter);
        }

        return result.filter(item => item);
    },
};

export const select = {
    /**
     * 查询记录（仅返回一个）
     * 
     * @param {string} table 表单名称
     * @param {object} where 查询条件
     * @param {object} options 查询配置
     * @returns 查询结果
     */
    single(table, where, options = {}) {
        const result = this.regular(
            table, where, options
        );

        result.action = "single";

        return result;
    },

    /**
     * 查询记录（返回结果数组）
     * 
     * @param {string} table 表单名称
     * @param {object} where 查询条件
     * @param {object} options 查询配置
     * @returns 查询结果
     */
    regular(table, where, options = {}) {
        const parameter = {};

        options.getter ??= gepend.inner.getter();
        options.setter ??= gepend.inner.setter(parameter);

        const { setter, getter } = options;

        if (Object.keys(where).length > 0) {
            options.where = where;
        }

        const suffix = [];

        const pack = gepend.build.tuple_literal;
        const quoter = depend.inner.column_quote;
        const holder = depend.inner.holder(setter, getter);

        const { flags = [], rename = {} } = options;

        const select = (() => {
            let list = options.select || "all";

            const result = [];

            if (list === "all") {
                result.push("*");
            } else {
                if (!Array.isArray(list)) {
                    list = [ list ];
                }

                for (let index = 0; index < list.length; index++) {
                    const current = list[index];

                    const column = quoter(current);

                    if (rename[current]) {
                        const text = rename[current];

                        result.push(`${column} AS ${quoter(text)}`);

                        continue;
                    }

                    result.push(column);
                }
            }

            if (flags.includes("includes-rowid")) {
                result.push("rowid");
            }

            return pack(result, false);
        })();

        if (options.where) {
            suffix.push(`WHERE ${gepend.build.where(
                options.where, setter, getter
            )}`);
        }

        if (options.by) {
            const by = options.by;

            if (by.group) {
                let list = by.group;

                if (!Array.isArray(list)) {
                    list = [ list ];
                }

                const get_name = item => {
                    return rename[item] || item;
                };

                suffix.push(`GROUP BY ${pack(list.map(
                    item => quoter(get_name(item))
                ), false)}`);
            }

            if (by.order) {
                let list = by.order;

                if (!Array.isArray(list)) {
                    list = [ list ];
                }

                suffix.push(`ORDER BY ${pack(list.map(item => {
                    const column = quoter(item.slice(1));

                    const is_desc = item.startsWith("-");

                    const direction = {
                        "true": "DESC",
                        "false": "ASC"
                    }[ is_desc.toString() ];
                    
                    return column + " " + direction;
                }), false)}`);
            }
        }

        if (options.having) {
            suffix.push(`HAVING ${gepend.build.where(
                options.having, setter, getter
            )}`);
        }

        if (options.paginate) {
            const { offset = 0, limit } = options.paginate;

            suffix.push(`LIMIT ${holder(limit)}`);
            suffix.push(`OFFSET ${holder(offset)}`);
        }

        const sentence = template.replace(
            "SELECT {{select}} FROM {{table}}{{suffix}}", {
                "table": quoter(table), "select": select,
                "suffix": suffix.length > 0 ?
                    " " + suffix.join(" ") : ""
            }
        );

        const inner = { getter, setter };

        const action = "execute";

        return {
            inner, action,
            "sentence": sentence,
            "parameter": parameter
        };
    },

    /**
     * 查询记录（返回迭代器）
     * 
     * @param {string} table 表单名称
     * @param {object} where 查询条件
     * @param {object} options 查询配置
     * @returns 查询结果
     */
    iterate(table, where, options = {}) {
        const result = this.regular(
            table, where, options
        );

        result.action = "iterate";
        
        return result;
    },
};

/**
 * 删除数据库中的现有条目
 * 
 * @param {string} table 需要删除条目的表单名称
 * @param {object} where 删除的条目需要达成的条件
 * @param {object} options 构建语句时使用的配置
 * @returns 执行结果
 */
function _delete(table, where = {}, options = {}) {
    const parameter = {};

    const { action = "request" } = options; 

    const getter = gepend.inner.getter();
    const setter = gepend.inner.setter(parameter);

    let sentence = template.replace(
        "DELETE FROM {{table}} WHERE {{where}}", {
            "table": quote(table, "double"),
            "where": gepend.build.where(
                where, setter, getter
            ) || "1 = 1"
        }
    );

    if (options.return_field) {
        sentence += depend.inner.returning(
            options.return_field, " "
        );
    }

    const inner = { getter, setter };

    return {
        inner, action,
        "sentence": sentence,
        "parameter": parameter
    };
}

export { _delete as delete };

export const selects = {
    /**
     * 查询记录（返回结果数组）
     * 
     * @param {any[][]} params_list 参数列表的列表
     * @param {object} options 查询配置
     * @returns 查询结果
     */
    regular(params_list, options = {}) {
        const parameter = {};
        const { unique = false } = options;

        const getter = gepend.inner.getter();
        const setter = gepend.inner.setter(parameter);

        const sentences = [];

        let last_result;

        for (let index = 0; index < params_list.length; index++) {
            const params = params_list[index];

            params[2] ??= {};

            params[2].getter = getter;
            params[2].setter = setter;

            last_result = select.regular(...params);

            const { sentence } = last_result;

            sentences.push(sentence);
        }

        last_result.parameter = parameter;

        last_result.sentence = sentences.map(
            (current) => `SELECT * FROM ( ${current} )`
        ).join(` ${unique ? "UNION" : "UNION ALL"} `);
        
        return last_result;
    },
};

/**
 * 更新数据库中的现有记录
 * 
 * @param {string} table 需要更新数据的记录所处的表单名称
 * @param {object} where 需要修改的条目需要达成的条件
 * @param {object} data 需要修改的字段的键值对
 * @param {object} options 构建语句时使用的配置
 * @returns 操作结果
 */
export function update(table, where, data, options = {}) {
    const parameter = {};

    const { action = "request" } = options; 

    const getter = gepend.inner.getter();
    const setter = gepend.inner.setter(parameter);

    const parts = [], entries = Object.entries(data);

    const quoter = depend.inner.column_quote;
    const holder = depend.inner.holder(setter, getter);

    const inner = { getter, setter, holder };

    for (let index = 0; index < entries.length; index++) {
        const entry = entries[index];

        const value = ((value) => {
            if (typeof value === "function") {
                return value(inner);
            }

            return holder(value);
        })(entry[1]);
        
        parts.push(`${quoter(entry[0])} = ${value}`);
    }

    let sentence = template.replace(
        "UPDATE {{table}} SET {{value}} WHERE {{where}}", {
            "table": quote(table), "value": parts.join(", "),
            "where": gepend.build.where(where, setter, getter)
        }
    );

    if (options.return_field) {
        sentence += depend.inner.returning(
            options.return_field, " "
        );
    }

    return {
        inner, action,
        "sentence": sentence,
        "parameter": parameter
    };
}

/**
 * 对数据库中的表单中的条目的进行计数操作
 * 
 * @param {string} table 需要进行计数的表单
 * @param {object} where 条目需要达成的条件
 * @returns {object} 表单内记录计数结果
 */
export function count(table, where) {
    const parameter = {};

    const getter = gepend.inner.getter();
    const setter = gepend.inner.setter(parameter);

    const parts = [];

    parts.push("SELECT COUNT(*)");
    parts.push("FROM " + quote(table));

    if (Object.keys(where).length > 0) {
        const parse = gepend.build.where;

        const parser = parse.bind(
            gepend.build
        );

        parts.push("WHERE " + parser(
            where, setter, getter
        ));
    };

    const sentence = parts.join(" ");

    const handler = (result) => {
        return result[0][0]["COUNT(*)"];
    };

    const inner = { getter, setter };

    const action = "execute";

    return {
        inner, action,
        "handler": handler,
        "sentence": sentence,
        "parameter": parameter
    };
}