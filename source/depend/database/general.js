import { repair_character as repair, quote_string } from "./depend/base.js";

/**
 * @callback ParameterSetter
 * @param {any} real 真实值
 * @param {string} nickname 数值别名
 * @returns {any} 设定参数值的真实值
 * 
 * @callback SequenceGetter
 * @returns {number} 获取到的序列值
 */

const inner = {
    /**
     * 调用就可以返回一个 SequenceGetter 的方法
     * 
     * @returns {SequenceGetter} 返回的 SequenceGetter 方法
     */
    getter() {
        let sequence = 0;

        return () => {
            return ++sequence;
        };
    },

    /**
     * 调用就可以返回一个 ParameterSetter 的方法
     * 
     * @returns {ParameterSetter} 返回的 ParameterSetter 方法
     */
    setter(parameter = {}) {
        return (real, nickname) => {
            parameter[nickname] = real;

            return real;
        };
    },
};

/**
 * 生成 Nickname 并添加到映射对象
 * 
 * @param {any} value 真实值
 * @param {number} sequence 参数值序号
 * @param {ParameterCallback} setter 添加映射对象的回调方法
 * @returns {string} 生成的 Nickname 字符串
 */
function placeholder(value, sequence, setter = inner.setter()) {
    const nickname = `Value_${repair(sequence, 6, "0")}`;

    setter(value, nickname);

    return ":" + nickname;
}

export const parse = {
    /**
     * 解析 WHERE Unit 配置对象为 SQL 语句
     *
     * @param {WhereUnitOptions} options 需要解析的 WHERE Unit 配置
     * @param {ParameterSetter} setter 设定参数值的方法
     * @param {SequenceGetter} getter 可以获取当前的 sequence 值的回调函数
     * @returns {string} 解析出来的 SQL 语句
     */
    where_unit(options = {}, setter = inner.setter(), getter = inner.getter()) {
        const { column, restrict } = options;

        let collate = options.collate || "binary";

        if (typeof collate === "string") {
            collate = {
                "global": collate
            };
        }

        const units = [], mapping = {
            "no-case": "NOCASE", "binary": "BINARY"
        };

        const entries = Object.entries(restrict);
        const support = Object.keys(this.restrict);

        for (let index = 0; index < entries.length; index++) {
            const [ key, value ] = entries[index];

            if (support.includes(key)) {
                collate[key] ??= collate.global || "binary";

                const collater = mapping[collate[key]];

                const suffix = ((key, value) => {
                    if (key === "length") {
                        return "";
                    }

                    return ` COLLATE ${value}`;
                })(key, collater);

                const handler = this.restrict[key].bind(
                    this.restrict
                );

                if (typeof handler === "function") {
                    const results = handler(
                        column, value, setter, getter
                    );

                    units.push(results.map(
                        item => item + suffix
                    ).join(" AND "));
                }
            }
        }

        return units.join(" AND ");
    },

    "restrict": {
        "inner": {
            "holder": (setter, getter) => {
                return (value) => {
                    return placeholder(
                        value, getter(), setter
                    );
                }
            },

            "column_quote": column => {
                return quote_string(column, "double");
            },
        },

        range(column, options, setter = inner.setter(), getter = inner.getter()) {
            const { exclude = [], minimum, maximum } = options;

            const quoter = this.inner.column_quote;
            const holder = this.inner.holder(setter, getter);

            if (typeof column === "object") {
                column = column.name;
            } else {
                column = quoter(column);
            }

            const i = (value) => {
                return exclude.includes(value);
            };

            const result = [];

            if (minimum) {
                const operator = (i(minimum) || i("left")) ? ">" : ">=";

                result.push(`${column} ${operator} ${holder(minimum)}`);
            }

            if (maximum) {
                const operator = (i(maximum) || i("right")) ? "<" : "<=";

                result.push(`${column} ${operator} ${holder(maximum)}`);
            }

            return result;
        },

        length(column, options, setter = inner.setter(), getter = inner.getter()) {
            const quoter = this.inner.column_quote;

            return this.range({
                "name": "LENGTH(" + quoter(column) + ")",
            }, options, setter, getter);
        },

        include(column, options, setter = inner.setter(), getter = inner.getter()) {
            if (Array.isArray(options)) {
                const append = {};
                const entries = Object.entries(options);

                options = {
                    "literal": entries.map(
                        ([key, value]) => {
                            if (isFinite(key)) {
                                return value;
                            }

                            append[key] = value;
                        }
                    ).filter(Boolean),

                    ...append
                };
            }

            const holder = this.inner.holder(setter, getter);

            column = quote_string(column, "double");

            const result = [], prefix = options.prefix || "";

            if (options.like) {
                const list = options.like.map(
                    item => holder(item)
                );

                for (let index = 0; index < list.length; index++) {
                    const value = list[index];

                    result.push(`${column} ${prefix}LIKE ${value}`);
                }
            }

            if (options.literal) {
                const list = options.literal.map(
                    item => holder(item)
                );

                result.push(`${column} ${prefix}IN ( ${list.join(", ")} )`);
            }
            
            return result;
        },

        exclude(column, options, setter = inner.setter(), getter = inner.getter()) {
            options.prefix = "NOT ";

            return this.include(
                column, options, setter, getter
            );
        }
    }
};

export const depend = {
    "build": {
        /**
         * 解析 WHERE 配置对象为 SQL 语句
         * 
         * @param {WhereOptions} options 需要解析的 WHERE 配置
         * @param {ParameterSetter} setter 添加参数值映射的回调函数
         * @param {SequenceGetter} getter 可以获取当前的 sequence 值的回调函数
         * @returns {string} 解析出来的 SQL 语句
         */
        where(options = {}, setter = inner.setter(), getter = inner.getter()) {
            if (!options.type || options.type === "unit") {
                if (options.column && options.restrict) {
                    return this.where({
                        "type": "group",
                        "relation": "or",
                        "children": [ options ]
                    }, setter, getter);
                }
            }

            const result = [];

            if (options.children || options.type === "group") {
                const relation = options.relation || "and";

                const children = options.children;

                children.relation = relation;

                return this.where(children, setter, getter);
            }

            if (Array.isArray(options)) {
                for (let index = 0; index < options.length; index++) {
                    const current = options[index];

                    current.type ??= "unit";

                    if (Array.isArray(current)) {
                        const content = this.where({
                            "children": [ ...current ],
                            "relation": current.relation || "and",
                        }, setter, getter);

                        result.push("( " + content + " )");
                    }

                    if (current.type === "unit") {
                        const content = parse.where_unit(
                            current, setter, getter
                        );

                        result.push("( " + content + " )");
                    }

                    if (current.type === "group") {
                        const content = this.where(
                            current, setter, getter
                        );

                        result.push("( " + content + " )");
                    }
                }

                const relation = options.relation || "or";

                return result.join(` ${relation.toUpperCase()} `);
            }
        },

        /**
         * 解析映射对象为 SQL 元组
         * 
         * @param {any[]} tuple 需要解析的元组信息
         * @param {boolean} packet 是否需要使用圆括号包裹
         * @param {ParameterSetter} setter 添加参数值映射的回调函数
         * @param {SequenceGetter} getter 可以获取当前的 sequence 值的回调函数
         * @returns {string} 解析出来的 SQL 元组
         */
        tuple_value(list = [], packet = true, setter = inner.setter(), getter = inner.getter()) {
            const values = [];

            for (let index = 0; index < list.length; index++) {
                const current = list[index];

                const value = this.placeholder(
                    current, getter(), setter
                );

                values.push(value);
            }

            const tuple_literal = this.tuple_literal;

            return tuple_literal(
                values, packet
            );
        },

        /**
         * 解析字面量数组为 SQL 元组
         * 
         * @param {string[]} list 需要处理的字符串数组
         * @param {boolean} packet 是否需要使用圆括号包裹
         * @returns {string} 解析出来的 SQL 元组
         */
        tuple_literal(list = [], packet = true) {
            const content = list.join(", ");

            if (!packet) return content;

            return "( " + content + " )";
        },

        "placeholder": placeholder
    },

    "inner": inner,
};