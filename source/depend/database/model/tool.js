import { quote_string } from "../depend/base.js";

export const sentence = {
    /**
     * 将绑定在参数对象中的参数以安全的形式嵌入到 SQL 语句当中
     * * 仅支持本代码库所自动生成的形式的嵌入
     * 
     * @param {string} sentence 需要处理的 SQL 语句 
     * @param {Record<string, any>} params 包含绑定的参数的对象
     * @returns {string} 将参数内嵌在 SQL 语句中的形式
     */
    "builtin": (sentence, params) => {
        const regex = /:(Value_\d+)/g;
        
        return sentence.replaceAll(
            regex, (_, key) => {
                const value = params[key];

                const type = typeof value;

                if (type === "string") {
                    return quote_string(
                        value, "single", {
                            "single": "'",
                            "default": "'"
                        }
                    );
                }

                const to_string = [
                    "number", "bigint"
                ];

                if (to_string.includes(type)) {
                    return value.toString();
                }

                if (value instanceof Buffer) {
                    const hex = value.toString("hex");
                    
                    return `X'${hex.toUpperCase()}'`;
                }
            }
        );
    },

    /**
     * 将 SQL 语句转换为 Token 列表
     * 
     * @typedef {Object} Token
     * @property {("symbol"|"word"|"string"|"number"|"blank")} type 类型
     * @property {string} value 值
     * @property {[  number, number ]} range 范围
     * 
     * @param {string} sentence 需要转换的 SQL 语句
     * @returns {Token[]} 分析得出的 Token 列表
     */
    "lexer": (sentence) => {
        let index = 0;

        const tokens = [];

        while (index < sentence.length) {
            const sindex = index;
            const char = sentence[index];

            if (char.trim() === "") {
                let current = char;

                while (current.trim() === "") {
                    current = sentence[index++];

                    if (!current) break;
                }

                index--;

                tokens.push({
                    "type": "blank",
                    "range": [
                        sindex, index
                    ]
                });

                continue;
            }

            switch (char) {
                case "(": case ")": case ",": {
                    tokens.push({
                        "type": "symbol",
                        "value": char,
                        "range": [
                            sindex, index
                        ]
                    });

                    index++; break;
                }

                case "'": case '"': {
                    const start = char;

                    let content = ""; index++;
                    let current = sentence[index];

                    while (current !== start) {
                        content += current;

                        current = sentence[++index];

                        if (!current) break;
                    }

                    tokens.push({
                        "type": "string",
                        "value": content,
                        "mode": {
                            "'": "single",
                            '"': "double"
                        } [start],
                        "range": [
                            sindex, index
                        ]
                    });
                    
                    index++; break;
                }

                case "X": case "x": {
                    let value = ""; index += 2;
                    let current = sentence[index];

                    while (current !== "'") {
                        value += current;

                        current = sentence[++index];

                        if (!current) break;
                    }

                    tokens.push({
                        "type": "blob",
                        "value": Buffer.from(
                            value, "hex"
                        ),
                        "range": [
                            sindex, index
                        ]
                    });

                    index++; break;
                }

                default: {
                    if (isFinite(char)) {
                        let value = "";

                        let current = char;

                        while (isFinite(current)) {
                            value += current;

                            current = sentence[++index];

                            if (!current) break;
                        }

                        tokens.push({
                            "type": "number",
                            "value": +value,
                            "range": [
                                sindex, index
                            ]
                        });
                    }

                    if (/[a-zA-Z]/.test(char)) {
                        let value = "";

                        let current = char;

                        while (current.trim() !== "") {
                            value += current;

                            current = sentence[++index];

                            if (!current) break;
                        }

                        tokens.push({
                            "type": "word",
                            "value": value,
                            "range": [
                                sindex, index
                            ]
                        });
                    }
                }
            }

            if (index === sindex) {
                tokens.push({
                    "type": "unknown",
                    "value": char,
                    "range": [
                        sindex, index++
                    ]
                });
            }
        }

        return tokens;
    }
};