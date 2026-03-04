import jwt from "jsonwebtoken";
import crypto from "node:crypto";
import node_canvas from "@napi-rs/canvas";
import { operator } from "../database/toolkit.js";

const HMAC_Key = process.env.VCS_HMAC_KEY;
const JWT_Secret = process.env.VCS_JWT_SECRET;
const DefaultIssuer = "VBS-Community";
const RefreshTokenPrefix = "refresh-token-";

/**
 * 生成验证码图片
 * 
 * @param {string} number 随机整数（000000 - 999999）
 * @returns {Buffer} 图片 PNG 数据
 */
export function generate_verify_code_image(number) {
    const colors = [ "red", "pink", "blue", "green", "black", "cyan", "orange" ];
    const styles = [ "normal", "bold", "italic", "underline", "strikethrough" ];
    const fonts = [ "Arial", "Times", "'New Roman'", "'Courier New'", "微软雅黑", "宋体" ];

    const width_px = 120, height_px = 40;

    const canvas = node_canvas
        .createCanvas(width_px, height_px);

    const context = canvas.getContext("2d");

    context.fillStyle = "#f0f0f0";
    context.fillRect(0, 0, width_px, height_px);

    const left_middle = {
        "x": width_px / 8, "y": height_px / 4
    };

    const step_length = width_px * 3 / 26 * 1.1;

    const pick = (array) => {
        const random = Math.random();

        return array[parseInt(
            array.length * random
        )];
    };

    context.textAlign = "center";
    context.textBaseline = "middle";

    const rdm = () => Math.random();

    for (let index = 0; index < 15; index++) {
        context.strokeStyle = `rgb(${rdm() * 255},${rdm() * 255},${rdm() * 255})`;
        context.beginPath();

        context.moveTo(rdm() * width_px, rdm() * height_px);
        context.lineTo(rdm() * width_px, rdm() * height_px);

        context.stroke();
    }

    for (let index = 0; index < 90; index++) {
        context.fillStyle = `rgb(${rdm() * 255},${rdm() * 255},${rdm() * 255})`;
        context.beginPath();
        
        context.arc(rdm() * width_px, rdm() * height_px, 1, 0, Math.PI * 2);
        context.fill();
    }

    const text = number.toString().slice(0, 6).padStart(6, "0");

    for (let index = 0; index < text.length; index++) {
        const char = text[index];

        let { x } = left_middle;

        x += 5 + step_length * index;

        const color = pick(colors);
        const style = pick(styles);
        const font = pick(fonts);

        context.font = `${style} 32px ${font}`;
        context.fillStyle = color;
        
        context.fillText(
            char, x, height_px / 2
        );
    }

    return canvas.toBuffer("image/png");
}

/**
 * 为密码生成散列值
 * 
 * @param {string} password 密码
 * @param {Date} registered_at 注册时间
 * @returns {string} 散列值
 */
function gen_hmac_password(password, registered_at) {
    const timestamp = registered_at.getTime();

    const salt = HMAC_Key + "-" + timestamp;

    return crypto.createHmac("sha256", salt)
        .update(password).digest("base64");
}

/**
 * 默认对象浅层属性合并器
 * 
 * @template {Record<string, any>} T
 * @param {T} defaults - 默认配置，包含所有必要属性
 * @param {Partial<T>} current - 当前配置，允许缺失部分属性
 * @returns {T} 合并后的对象
 */
const default_merger = (defaults, current) => {
    return { ...defaults, ...current };
};

/**
 * 获取批量插入的返回结果
 * 
 * @param {object[]} records 需要插入的记录列表
 * @param {string} table_name 需要插入的表的名称
 * @returns {object[]} 返回结果
 */
function get_insert_results(records, table_name) {
    const field_list = "all";

    const record = operator.record();
    const insert = record.insert.bind(record);

    return insert(table_name, records, {
        "action": "execute", "mode": "batch",
        "return_field": field_list, "scale": 32
    }).flat(3);
}

/**
 * 获取删除的返回结果
 * 
 * @param {object} where 需要删除的纪录的条件
 * @param {string} table_name 需要删除的表的名称
 * @returns {object[]} 返回结果
 */
function get_delete_results(where, table_name) {
    const field_list = "all";

    const record = operator.record();
    const _delete = record.delete.bind(record);

    return _delete(table_name, where, {
        "action": "execute",
        "return_field": field_list
    }).flat(3);
}

/**
 * 获取删除的返回结果
 * 
 * @param {object} where 需要更新的纪录的条件
 * @param {string} table_name 需要更新的表的名称
 * @param {object} object 需要更新的字段集合
 * @returns {object[]} 返回结果
 */
function get_update_results(where, table_name, object) {
    const field_list = "all";

    const record = operator.record();
    const update = record.update.bind(record);

    return update(table_name, where, object, {
        "action": "execute", "return_field": field_list
    }).flat(3);
}

/**
 * @typedef {Object} RegisterUser
 * @property {string} username 账户名称
 * @property {string} nickname 用户昵称
 * @property {string} email 邮箱地址
 * @property {string} password 用户密码
 * @property {string} [description] 用户简介
 * @property {Date} created_at 创建时间
 * @property {Date} [last_login_at] 最后登录时间
 * @property {Date} [modified_at] 资料卡最后修改时间
 * @property {boolean} is_deleted 是否已删除账户
 * @property {("normal"|"banned")} [status] 用户状态
 * 
 * @typedef {Object} RUTFix
 * @property {string} password 经过HMAC处理的密码
 * @property {number} user_id 注册取得的用户数字标识符
 * @property {Date} created_at 账户创建时间
 * 
 * @typedef {(RegisterUser & RUTFix)} UserRecord
 */

/**
 * 转换数据库记录为UserRecord
 * 
 * @param {object} record 需要转换的记录
 * @returns {UserRecord} 转换结果
 */
function convert_user_record(record) {
    record.user_id = record.id;

    delete record.id;

    const restore =
        restore_at_fields;

    return restore(record);
}

/**
 * 修改字段名称以 _at 结尾的字段值为 RFC 3339 字符串
 * 
 * @template T
 * @param {T} record 需要转换的记录
 * @returns {T} 转换结果
 */
function convert_at_fields(record) {
    return Object.fromEntries(
        Object.entries(record).map(
            ([field, value]) => {
                if (value !== null) {
                    if (field.endsWith("_at")) {
                        value = new Date(value);
                    }
                }

                return [ field, value ];
            }
        )
    );
}

/**
 * 还原字段名称以 _at 结尾的字段值为 RFC 3339 字符串的字段为 Date 对象
 * 
 * @param {object} record 需要转换的记录
 * @returns {object} 转换结果
 */
function restore_at_fields(record) {
    return Object.fromEntries(
        Object.entries(record).map(
            ([field, value]) => {
                if (value !== null) {
                    if (field.endsWith("_at")) {
                        value = new Date(value);
                    }
                }

                return [ field, value ];
            }
        )
    );
}

/**
 * 注册用户
 * 
 * @param {RegisterUser} user 用户列表
 * @param {RegisterUser} defaults 默认值集合
 * @param {typeof default_merger} merger 属性合并器
 * @returns {UserRecord} 用户记录
 */
export function register_user(
    user, defaults = {}, merger = default_merger
) {
    if (!user) return null;

    const records = [];

    let { created_at } = user;

    created_at ??= defaults.created_at;

    const password = gen_hmac_password(
        user.password, created_at
    );

    const modified = { password };

    const target = {
        ...defaults, ...modified 
    };

    const modify = convert_at_fields;

    const mapping = {
        "$user_id": "id"
    };

    records.push(Object.fromEntries(
        Object.entries(modify(
            merger(user, target)
        )).map(([field, value]) => {
            if (field.startsWith("$")) {
                field = mapping[field];
            }

            return [ field, value ];
        })
    ));

    const get_results = get_insert_results;

    const results = get_results(
        records, "users"
    );

    const convert = convert_user_record;

    return results.map(convert)[0];
}

/**
 * 更新最后登录时间
 * 
 * @typedef {Object} UULLA
 * @property {number} user_id 用户数字标识符
 * @property {Date} last_login_at 最后登录时间
 * 
 * @param {UULLA} update 用户数字标识符
 * @param {UULLA} defaults 默认值集合
 * @param {typeof default_merger} merger 属性合并器
 * @returns {UserRecord} 用户记录
 */
export function update_user_last_login_at(
    update, defaults = {}, merger = default_merger
) {
    if (!update) return null;

    const current = merger(
        update, defaults
    );

    const get_results = get_update_results;

    const { last_login_at } = current;

    const select_user_where = {
        "type": "unit",
        "column": "id",
        "restrict": {
            "include": [
                current.user_id
            ]
        }
    };

    const results = get_results(
        select_user_where, "users", {
            "last_login_at": last_login_at
                .toISOString()
        }
    );

    const convert = convert_user_record;

    return results.map(convert)[0];
}

/**
 * 获取用户列表
 * 
 * @typedef {("username"|"nickname"|"email"|"status")} G4FN
 * 
 * @typedef {Object} GULBFields
 * @property {G4FN} field 查询字段
 * @property {string[]} values 查询值
 * 
 * @param {GULBFields} where 查询条件
 * @param {number} count 每页历史记录数
 * @param {number} index 当前页索引（从 1 开始）
 * @returns {RefreshTokenHistoryList} 带有历史信息的刷新令牌
 */
export function get_user_list_by_fields(
    where, count = 50, index = 1
) {
    if (!where) return null;

    const record = operator.record();

    if (!Array.isArray(where.values)) {
        where.values = [ where.values ];
    }

    const paginate = {
        "limit": count,
        "offset": (index - 1) * count
    };

    const where = {
        "type": "unit",
        "column": where.field,
        "restrict": {
            "include": where.values
        }
    };

    const results = record.select(
        "users", where, { paginate }
    ).flat(3);

    const convert = convert_user_record;

    return results.map(convert);
}

/**
 * 获取用户
 * 
 * @param {number} user_id 用户标识符
 * @returns {UserRecord} 用户记录
 */
export function get_user(user_id) {
    if (!user_id) return null;

    const record = operator.record();

    const record_where = {
        "type": "unit",
        "column": "id",
        "restrict": {
            "include": [
                user_id
            ]
        }
    };

    const results = record.select(
        "users", record_where
    ).flat(3);

    const convert = convert_user_record;

    return results.map(convert)[0];
}

/**
 * 批量获取用户
 * 
 * @param {number} user_ids 用户标识符
 * @returns {UserRecord[]} 用户记录
 */
export function get_users(user_ids = []) {
    if (!user_ids) return null;

    const record = operator.record();

    const record_where = {
        "type": "unit",
        "column": "id",
        "restrict": {
            "include": user_ids
        }
    };

    const results = record.select(
        "users", record_where
    ).flat(3);

    const convert = convert_user_record;

    return results.map(convert);
}

/**
 * @typedef {Object} UpdateUserInfo
 * @property {number} user_id 用户标识符
 * @property {Date} operated_at 操作时间
 * @property {number} operator_id 操作者识别码
 * @property {string} [comments] 操作注解
 * 
 * @typedef {Object} UUPFix
 * @property {string} password 新密码明文
 * @property {Date} created_at 账户创建时间
 * 
 * @typedef {(UpdateUserInfo & UUPFix)} UpdateUserPassword
 * 
 * @typedef {("user_id"|"created_at"|"last_login_at"|
 *  "modified_at"|"is_deleted"|"status")} UICFNOmitFields
 * 
 * @typedef {(keyof Omit<UserRecord, UICFNOmitFields>)} UICFNFields
 * 
 * @typedef {Object} UICFix
 * @property {number} change_id 变更标识符
 * @property {UICFNFields} field_name 字段名称
 * @property {string} new_value 新值
 * @property {string} old_value 旧值
 * 
 * @typedef {(UpdateUserInfo & UICFix)} UserInfoChange
 * 
 * @typedef {Object} UUPResults
 * @property {object} record 用户记录
 * @property {UserRecord} record.new 更新后的记录
 * @property {UserRecord} record.old 更新前的记录
 * @property {UserInfoChange} change 变更记录
 */

/**
 * 更新用户密码
 * 
 * @param {UpdateUserPassword} update 更新信息
 * @param {UpdateUserPassword} defaults 默认值集合
 * @param {typeof default_merger} merger 属性合并器
 * @returns {UUPResults} 返回结果
 */
export function update_user_password(
    update, defaults = {}, merger = default_merger
) {
    if (!update) return null;

    const current = merger(update, defaults);

    const password = gen_hmac_password(
        current.password, current.created_at
    );

    const record = operator.record();

    const result_lists = {};

    result_lists.update = record.update(
        "users", {
            "type": "group",
            "relation": "and",
            "children": [
                {
                    "type": "unit",
                    "column": "id",
                    "restrict": {
                        "include": [
                            user_id
                        ]
                    }
                }
            ]
        }, { password }, {
            "action": "execute",
            "return_field": "all",
        }
    ).flat(3);

    const convert = convert_user_record;

    const modified = convert_at_fields(current);

    const records = [{
        "user_id": modified.user_id,
        "operator_id": modified.operator_id,
        "comments": modified.comments,
        "operated_at": modified.operated_at,
        "field_name": "password",
        "new_value": results[0].password,
        "old_value": results[0].password
    }];

    const get_results = get_insert_results;

    result_lists.insert = get_results(
        records, "user_info_changes"
    );

    return {
        "record": result_lists.update.map(convert)[0],

        "change": result_lists.insert.map((record) => {
            record.change_id = record.id;

            delete record.id;

            return restore_at_fields(record);
        })
    };
}

/**
 * @typedef {Exclude<UICFNFields, "password">} UUICFNFields
 * 
 * @typedef {Object} UUICFix
 * @property {string} new_value 新值
 * @property {UUICFNFields} field_name 字段名称
 * 
 * @typedef {(UpdateUserInfo & UUICFix)} UpdateUserInfoCard
 * 
 * @typedef {UUPResults} UUICResults
 */

/**
 * 更新用户信息卡片
 * 
 * @param {UpdateUserInfoCard} update 更新信息
 * @param {UpdateUserInfoCard} defaults 默认值集合
 * @param {typeof default_merger} merger 属性合并器
 * @returns {UUICResults} 返回结果
 */
export function update_user_infocard(
    update, defaults = {}, merger = default_merger
) {
    if (!update) return null;

    const current = merger(update, defaults);

    const record = operator.record();

    const { field_name } = current;

    const new_datas = {
        [ field_name ]:
            current.new_value
    };

    const result_lists = {};

    const where = {
        "type": "unit",
        "column": "id",
        "restrict": {
            "include": [
                user_id
            ]
        }
    };

    result_lists.update = record.update(
        "users", where, new_datas, {
            "action": "execute",
            "return_field": "all",
        }
    ).flat(3);

    const convert = convert_user_record;

    const modified = convert_at_fields(current);

    const records = [{
        "user_id": modified.user_id,
        "operator_id": modified.operator_id,
        "comments": modified.comments,
        "operated_at": modified.operated_at,
        "field_name": modified.field_name,
        "new_value": results[0][field_name],
        "old_value": results[0][field_name]
    }];

    const get_results = get_insert_results;

    result_lists.insert = get_results(
        records, "user_info_changes"
    );

    return {
        "record": result_lists.update.map(convert)[0],

        "change": result_lists.insert.map((record) => {
            record.change_id = record.id;

            delete record.id;

            return restore_at_fields(record);
        })
    };
}

/**
 * @typedef {Object} CreateRefreshToken
 * @property {number} user_id 所属用户标识符
 * @property {Date} expired_at 令牌过期时间
 * @property {Date} created_at 令牌创建时间
 * 
 * @typedef {Object} RTRFix
 * @property {string} content 令牌内容
 * @property {number} token_id 令牌数字标识符
 * 
 * @typedef {(CreateRefreshToken & RTRFix)} RefreshTokenRecord
 */

/**
 * 将刷新令牌记录转换为 RefreshTokenRecord 对象
 * 
 * @param {object} record 刷新令牌记录
 * @returns {RefreshTokenRecord} 刷新令牌
 */
function convert_refresh_token(record) {
    record.token_id = record.id;

    delete record.id;

    return restore_at_fields(record);
}

/**
 * 为用户生成刷新令牌
 * 
 * @param {CreateRefreshToken} token 令牌列表
 * @param {CreateRefreshToken} defaults 默认值集合
 * @param {typeof default_merger} merger 属性合并器
 * @returns {RefreshTokenRecord} 刷新令牌记录
 */
export function create_refresh_token(
    token, defaults = {}, merger = default_merger
) {
    if (!token) return null;

    const records = [], RTP = RefreshTokenPrefix;

    const gen_token_content = gen_hmac_password;

    let { created_at, expired_at } = token;

    created_at ??= defaults.created_at;
    expired_at ??= defaults.expired_at;

    const modified = {
        "content": gen_token_content(
            RTP + token.user_id, created_at
        ),
        "created_at": created_at.toISOString(),
        "expired_at": expired_at.toISOString()
    };

    records.push(merger(token, {
        ...defaults, ...modified 
    }));

    const get_results = get_insert_results;

    const results = get_results(
        records, "refresh_tokens"
    );

    const convert = convert_refresh_token;

    return results.map(convert)[0];
}

/**
 * @typedef {Object} GenerateAccessToken
 * @property {number} user_id 所属用户标识符
 * @property {string} issuer 令牌发行者
 * @property {Date} created_at 令牌创建时间
 * @property {Date} expired_at 令牌过期时间
 */

/**
 * 获取秒级时间戳
 * 
 * @param {Date} [instance] 时间实例
 * @returns {number} 秒级时间戳
 */
const get_ts = (instance) => {
    const timestamp = instance.getTime();
    
    return parseInt(timestamp / 1000);
};

/**
 * 为用户生成访问令牌
 * 
 * @param {GenerateAccessToken} token 令牌
 * @param {GenerateAccessToken} defaults 默认值集合
 * @param {typeof default_merger} merger 属性合并器
 * @returns {string} 访问令牌
 */
export function generate_access_token(
    token, defaults = {}, merger = default_merger
) {
    if (!token) return null;

    const current = merger(
        token, defaults
    );

    const get_group_list =
        get_group_list_by_user_id;

    const group_list = get_group_list(
        current.user_id, 256, 1
    );

    const user_group = get_user_group(
        group_list.list.map(group => group.group_id)
    );

    const payload = {
        "iss": current.issuer || DefaultIssuer,
        "sub": "user_" + current.user_id,
        "aud": group_list.map((group) => {
            const { code } = user_group;

            return { code, "exp": group.expired_at ?
                get_ts(group.expired_at) : null
            };
        }),
        "type": "user",
        "iat": get_ts(current.created_at),
        "exp": current.expired_at ?
            get_ts(current.expired_at) : null,
    };

    payload.jti = gen_hmac_password(
        JSON.stringify(payload), current.created_at
    );

    return jwt.sign(payload, JWT_Secret, options);
}

/**
 * @typedef {Object} RevokeToken
 * @property {number} token_id 令牌标识符
 * @property {Date} revoked_at 吊销时间
 * @property {number} revoker_id 操作者识别码
 * @property {number} reason_id 吊销原因数字代号
 * @property {string} [comments] 操作注解文本
 * 
 * @typedef {Object} RTRFix_2
 * @property {number} log_id 审计日志标识符
 * 
 * @typedef {(RevokeToken & RTRFix_2)} RevokeTokenRecord
 */

/**
 * 吊销刷新令牌
 * 
 * @typedef {Object} RRTResults
 * @property {RevokeTokenRecord} audit 吊销记录
 * @property {RefreshTokenRecord} record 更新后的记录
 * 
 * @param {RevokeToken} token 吊销列表
 * @param {RevokeToken} defaults 默认值集合
 * @param {typeof default_merger} merger 属性合并器
 * @returns {RRTResults} 吊销记录
 */
export function revoke_refresh_token(
    token, defaults = {}, merger = default_merger
) {
    if (!token) return null;

    const records = [];

    const current = merger(
        token, defaults
    );

    const { revoked_at } = current;

    records.push({
        "target_type": "token",
        "operate_type": "revoke",
        "operated_at": revoked_at.toISOString(),
        "target_id": current.token_id,
        "operator_id": current.revoker_id,
        "reason_id": current.reason_id,
        "comments": current.comments
    });

    const results = get_insert_results(
        records, "operate_audit_logs"
    );

    const convert = convert_refresh_token;

    return {
        "audit": results.map((result) => ({
            "log_id": result.id,
            "token_id": result.target_id,
            "revoked_at": new Date(
                result.operated_at
            ),
            "revoker_id": result.operator_id,
            "reason_id": result.reason_id,
            "comments": result.comments
        }))[0],

        "token": get_update_results(
            where, "refresh_tokens", {
                "status": "revoked",
            }
        ).map(convert)[0]
    }
}

/**
 * * @template {keyof RefreshTokenRecord} T
 * 
 * @typedef {Object} GetRefreshToken
 * @property {Extract<T, string>} field 字段名称
 * @property {RefreshTokenRecord[T]} value 字段值
 */

/**
 * 通过刷新令牌信息获取刷新令牌记录
 * 
 * @typedef {keyof RefreshTokenRecord} K
 * 
 * @param {GetRefreshToken<K>} token 刷新令牌信息
 * @param {GetRefreshToken<K>} defaults 默认值集合
 * @param {typeof default_merger} merger 属性合并器
 * @returns {RefreshTokenRecord} 刷新令牌记录
 */
export function get_refresh_token(
    token, defaults = {}, merger = default_merger
) {
    if (!token) return null;

    const current = merger(
        token, defaults
    );

    const record = operator.record();

    const records = record.select(
        "refresh_tokens", {
            "type": "unit",
            "column": current.field,
            "restrict": {
                "include": [
                    current.value
                ]
            }
        }
    ).flat(3);

    const convert = convert_refresh_token;

    return records.map(convert)[0];
}

/**
 * @typedef {Object} OperateLog
 * @property {number} log_id 审计日志标识符
 * @property {("revoke")} operate_type 操作类型
 * @property {Date} operated_at 操作时间
 * @property {number} operator_id 操作者识别码
 * @property {string} [comments] 操作注解
 * @property {number} reason_id 原因数字代号
 */

/**
 * 通过刷新令牌标识符获取刷新令牌记录
 * 
 * @typedef {Object} RefreshTokenHistoryList
 * @property {number} user_id 用户标识符
 * @property {OperateLog[]} list 历史记录
 * 
 * @param {number} token_id 刷新令牌标识符列表
 * @param {number} count 每页历史记录数
 * @param {number} index 当前页索引（从 1 开始）
 * @returns {RefreshTokenHistoryList} 刷新令牌历史信息
 */
export function get_refresh_token_history_list(
    token_id, count = 50, index = 1
) {
    if (!token_id) return null;

    const record = operator.record();

    const list = record.select(
        "operate_audit_logs", {
            "type": "group",
            "relation": "and",
            "children": [
                {
                    "type": "unit",
                    "column": "target_type",
                    "restrict": {
                        "include": [ "token" ]
                    }
                },
                {
                    "type": "unit",
                    "column": "target_id",
                    "restrict": {
                        "include": [ token_id ]
                    }
                }
            ]
        }, {
            "paginate": {
                "limit": count,
                "offset": (index - 1) * count
            }
        }
    ).flat(3);

    return list.map((log) => ({
        "log_id": log.id,
        "operate_type": log.operate_type,
        "operated_at": new Date(log.operated_at),
        "operator_id": log.operator_id,
        "comments": log.comments,
        "reason_id": log.reason_id
    }));
}

/**
 * @typedef {Object} CreateGroup
 * @property {string} name 用户组名称
 * @property {string} code 用户组代号
 * @property {string} [description] 用户组描述
 * @property {number} creator_id 创建者识别码
 * @property {Date} created_at 创建时间
 * @property {Date} [modified_at] 元数据修改时间
 * 
 * @typedef {Object} GRFix
 * @property {number} group_id 用户组标识符
 * @property {object} counters 用户组计数
 * @property {number} counters.member 成员数量
 * 
 * @typedef {(CreateGroup & GRFix)} GroupRecord
 */

/**
 * 用户组记录转换
 * 
 * @param {object} record 需要转换的记录
 * @returns {GroupRecord}
 */
function convert_user_group(record) {
    record.group_id = record.id;

    delete record.id;

    record.counters = {
        "member": record.member_count
    };

    delete record.member_count;

    record.created_at = new Date(
        record.created_at
    );
    record.modified_at = record.modified_at ?
        new Date(record.modified_at) : null;

    return record;
}

/**
 * 创建用户组
 * 
 * @param {CreateGroup[]} groups 用户组列表
 * @param {CreateGroup} defaults 默认值集合
 * @param {typeof default_merger} merger 属性合并器
 * @returns {GroupRecord[]} 用户组记录
 */
export function create_user_group(
    group, defaults = {}, merger = default_merger
) {
    if (!group) return null;

    const records = [];

    let { created_at, modified_at } = group;

    created_at ??= defaults.created_at;
    modified_at ??= defaults.modified_at;

    const modified = {
        "created_at": created_at.toISOString(),
        "modified_at": modified_at ?
            modified_at.toISOString() : null
    };

    records.push(merger(current, {
        ...defaults, ...modified 
    }));

    const get_results = get_insert_results;

    const results = get_results(
        records, "user_groups"
    );

    const convert = convert_user_group;

    return results.map(convert)[0];
}

/**
 * 获取用户组信息
 * 
 * @param {number} group_id 需要获取的用户组标识符
 * @returns {GroupRecord} 用户组记录
 */
export function get_user_group(group_id) {
    const record = operator.record();

    const records = record.select(
        "user_groups", {
            "type": "unit",
            "column": "id",
            "restrict": {
                "include": [
                    group_id
                ]
            }
        }
    ).flat(3);

    const convert = convert_user_group;

    return records.map(convert)[0];
}

/**
 * @typedef {Object} AddU2G
 * @property {number} user_id 用户标识符
 * @property {number} group_id 用户组标识符
 * @property {number} operator_id 操作者识别码
 * @property {Date} operated_at 操作时间
 * @property {Date} [expired_at] 过期时间
 * @property {string} [comments] 操作注解
 * @property {number} reason_id 原因数字代号
 * 
 * @typedef {Object} MGRRFix
 * @property {number} member_id 成员标识符
 * 
 * @typedef {(Omit<AddU2G, "comments"|"reason_id"> & MGRRFix)} MemberGroupRelationRecord
 * 
 * @typedef {Object} AUTGALFix
 * @property {number} log_id 操作日志标识符
 * @property {("created"|"expired"|"deleted")} status 关系状态
 * 
 * @typedef {(AddU2G & AUTGALFix)} AddUserToGroupAuditLog
 */

/**
 * 添加用户到用户组
 * 
 * @typedef {Object} AddU2GResults
 * @property {AddUserToGroupAuditLog} audit 操作日志
 * @property {Object} group 用户组记录
 * @property {GroupRecord} group.new 更新后的记录
 * @property {GroupRecord} group.old 更新前的记录
 * @property {MemberGroupRelationRecord} relation 成员关系记录
 * 
 * @param {AddU2G} behavior 添加行为
 * @param {AddU2G} defaults 默认值集合
 * @param {typeof default_merger} merger 属性合并器
 * @returns {AddU2GResults} 用户组记录
 */
export function add_user_to_group(
    behavior, defaults = {}, merger = default_merger
) {
    if (!behavior) return null;
    
    const record_lists = {
        "group_users": [], "operate_audit_logs": []
    };

    const current = merger(behavior, defaults);

    const { comments, reason_id, ...create } = current;
    const { operated_at, expired_at } = create;

    const modified = {
        "operated_at": operated_at.toISOString(),
        "expired_at": expired_at ?
            expired_at.toISOString() : null
    };

    record_lists.group_users.push(
        merger(create, modified)
    );

    record_lists.operate_audit_logs.push({
        "operate_type": "add-user-to-group",
        "target_id": create.user_id,
        "target_type": "user",
        "operator_id": create.operator_id,
        "reason_id": reason_id,
        "comments": comments,
        "operated_at": modified.operated_at,
        "extra_info": JSON.stringify({
            "expired_at": modified.expired_at,
            "target_group": create.group_id
        }),
    });

    const get_results = get_insert_results;

    const result_lists = Object.fromEntries(
        Object.entries(record_lists).map(([ table, records ]) => {
            return [ table, get_results(records, table) ];
        })
    );

    const group = get_user_group(current.group_id);

    const where = {
        "type": "unit",
        "column": "id",
        "restrict": {
            "include": [
                current.group_id
            ]
        }
    };

    return {
        "audit": result_lists.operate_audit_logs.map((record) => {
            const infos = JSON.parse(record.extra_info);

            return {
                "log_id": record.id,
                "user_id": record.target_id,
                "operator_id": record.operator_id,
                "reason_id": record.reason_id,
                "comments": record.comments,
                "expired_at": infos.expired_at ?
                    new Date(infos.expired_at) : null,
                "group_id": infos.target_group,
                "operated_at": new Date(record.operated_at),
            };
        })[0],

        "group": {
            "old": group,
            "now": get_update_results(
                where, "user_groups", {
                    "member_count":
                        group.counters.member + 1
                }
            ).map(convert_user_group)[0]
        },

        "relation": result_lists.group_users.map((record) => ( {
            "member_id": record.id,
            "user_id": record.user_id,
            "group_id": record.group_id,
            "status": record.status,
            "expired_at": record.expired_at ?
                new Date(record.expired_at) : null,
            "operated_at": new Date(record.operated_at),
            "operator_id": record.operator_id
        }))[0],
    };
}

/**
 * @typedef {Omit<AddU2G, "expired_at">} RemoveU4G
 * 
 * @typedef {Omit<AddUserToGroupAuditLog,
 *  ("expired_at"|"status")>} RemoveUserFromGroupAuditLog
 */

/**
 * 转换数据库记录为用户组成员关系记录
 * 
 * @param {object} record 需要转换的记录
 * @returns {MemberGroupRelationRecord} 转换结果
 */
function convert_group_user(record) {
    return {
        "member_id": record.id,
        "user_id": record.user_id,
        "group_id": record.group_id,
        "status": record.status,
        "expired_at": record.expired_at ?
            new Date(record.expired_at) : null,
        "operated_at": new Date(record.operated_at),
        "operator_id": record.operator_id
    };
}

/**
 * 添加用户到用户组
 * 
 * @typedef {Object} RemoveU4GResults
 * @property {RemoveUserFromGroupAuditLog} audits 操作日志
 * @property {MemberGroupRelationRecord} relations 成员关系记录
 * 
 * @param {RemoveU4G} behavior 添加行为
 * @param {RemoveU4G} defaults 默认值集合
 * @param {typeof default_merger} merger 属性合并器
 * @returns {RemoveU4GResults} 用户组记录
 */
export function remove_user_from_group(
    behavior, defaults = {}, merger = default_merger
) {
    if (!behavior) return null;

    const record_lists = {
        "insert": [], "update": []
    };

    const current = merger(behavior, defaults);
    const { comments, reason_id, ...remove } = current;
    const { operated_at } = remove;

    const modified = {
        "operated_at": operated_at.toISOString()
    };

    record_lists.update.push(
        merger(remove, modified)
    );

    record_lists.insert.push({
        "operate_type": "remove-user-form-group",
        "target_id": remove.user_id,
        "target_type": "user",
        "operator_id": remove.operator_id,
        "reason_id": reason_id,
        "comments": comments,
        "operated_at": modified.operated_at,
        "extra_info": JSON.stringify({
            "target_group": remove.group_id
        }),
    });

    const convert = convert_group_user;

    const target_record_select_where = {
        "type": "group",
        "relation": "and",
        "children": [
            {
                "type": "unit",
                "column": "user_id",
                "restrict": {
                    "include": [
                        remove.user_id
                    ]
                }
            },
            {
                "type": "unit",
                "column": "group_id",
                "restrict": {
                    "include": [
                        remove.group_id
                    ]
                }
            }
        ]
    };

    const group = get_user_group(current.group_id);

    const where = {
        "type": "group",
        "relation": "and",
        "children": [
            {
                "type": "unit",
                "column": "id",
                "restrict": {
                    "include": [
                        current.group_id
                    ]
                }
            }
        ]
    };

    return {
        "audits": get_insert_results(
            record_lists.insert, "operate_audit_logs"
        ).map((record) => {
            const infos = JSON.parse(record.extra_info);

            return {
                "log_id": record.id,
                "user_id": record.target_id,
                "operator_id": record.operator_id,
                "reason_id": record.reason_id,
                "comments": record.comments,
                "group_id": infos.target_group,
                "operated_at": new Date(record.operated_at),
            };
        })[0],

        "group": {
            "old": group,
            "now": get_update_results(
                where, "user_groups", {
                    "member_count":
                        group.counters.member - 1
                }
            ).map(convert_user_group)[0]
        },

        "relations": get_delete_results(
            target_record_select_where, "group_users"
        ).map((record) => convert(record))[0]
    };
}

/**
 * 根据用户标识符获取所属的用户组信息
 * 
 * @param {number} user_id 用户标识符
 * @param {number} count 每页用户组数
 * @param {number} index 当前页索引（从 1 开始）
 * @returns {MemberGroupRelationRecord[]} 用户组信息
 */
export function get_group_list_by_user_id(
    user_id, count = 50, index = 1
) {
    if (!user_id) return null;

    const record = operator.record();

    const paginate = {
        "limit": count,
        "offset": (index - 1) * count
    };

    const records = record.select(
        "group_users", {
            "type": "unit",
            "column": "user_id",
            "restrict": {
                "include": [
                    user_id
                ]
            }
        }, { paginate }
    ).flat(3);

    const convert = convert_group_user;

    return records.map(convert);
}

/**
 * 根据用户标识符获取所属的用户组信息
 * 
 * @typedef {Object} GetGroupMember
 * @property {number} user_id 用户标识符
 * @property {number} group_id 用户组标识符
 * 
 * @param {RemoveU4G} member 目标成员
 * @param {RemoveU4G} defaults 默认值集合
 * @param {typeof default_merger} merger 属性合并器
 * @returns {MemberGroupRelationRecord} 用户组信息
 */
export function get_group_member(
    member, defaults = {}, merger = default_merger
) {
    if (!member) return null;

    const current = merger(
        member, defaults
    );

    const record = operator.record();

    const records = record.select(
        "group_users", {
            "type": "group",
            "relation": "and",
            "children": [
                {
                    "type": "unit",
                    "column": "user_id",
                    "restrict": {
                        "include": [
                            current.user_id
                        ]
                    }
                },
                {
                    "type": "unit",
                    "column": "group_id",
                    "restrict": {
                        "include": [
                            current.group_id
                        ]
                    }
                }
            ]
        }
    ).flat(3);

    const convert = convert_group_user;

    return records.map(convert)[0];
}

/**
 * 根据用户标识符获取所属的用户组信息
 * 
 * @param {number} group_id 用户组标识符
 * @param {number} count 每页用户数
 * @param {number} index 当前页索引（从 1 开始）
 * @returns {MemberGroupRelationRecord[]} 用户组信息
 */
export function get_group_user_list(
    group_id, count = 50, index = 1
) {
    if (!group_id) return null;

    const record = operator.record();

    const paginate = {
        "limit": count,
        "offset": (index - 1) * count
    };

    const records = record.select(
        "group_users", {
            "type": "unit",
            "column": "group_id",
            "restrict": {
                "include": [
                    group_id
                ]
            }
        }, { paginate }
    ).flat(3);

    const convert = convert_group_user;

    return records.map(record => convert(record));
}

/**
 * 将游客令牌记录转换为 GuestTokenRecord 对象
 * 
 * @typedef {Object} GuestTokenRecord
 * @property {number} token_id 令牌标识符
 * @property {string} ip_address IP 地址
 * @property {Date} created_at 令牌创建时间
 * @property {Date} expired_at 令牌过期时间
 * @property {string} jti 令牌标识符
 * 
 * @param {object} record 游客令牌记录
 * @returns {GuestTokenRecord} 游客令牌
 */
function convert_guest_token(record) {
    record.token_id = record.id;

    delete record.id;

    return restore_at_fields(record);
}

/**
 * 生成游客令牌
 * 
 * @typedef {Object} GenerateGuestToken
 * @property {string} [issuer] 令牌发行者
 * @property {Date} created_at 令牌创建时间
 * @property {Date} expired_at 令牌过期时间
 * @property {string} ip_address 游客IP地址
 * 
 * @param {GenerateGuestToken} token 游客令牌
 * @param {GenerateGuestToken} defaults 默认值集合
 * @param {typeof default_merger} merger 属性合并器
 * @returns {string} 游客令牌
 */
export function generate_guest_token(
    token, defaults = {}, merger = default_merger
) {
    if (!token) return null;

    const current = merger(
        token, defaults
    );

    const payload = {
        "iss": current.issuer || DefaultIssuer,
        "iat": get_ts(current.created_at),
        "exp": get_ts(current.expired_at),
        "ip": current.ip_address,
        "type": "guest"
    };

    payload.jti = gen_hmac_password(
        JSON.stringify(payload), current.created_at
    );

    const { created_at, expired_at } = current;

    const records = [{
        "jti": payload.jti,
        "ip_address": current.ip_address,
        "created_at": created_at.toISOString(),
        "expired_at": expired_at.toISOString()
    }];

    const results = get_insert_results(
        records, "guest_tokens"
    );

    const options = { "algorithm": "HS256" };

    const convert = convert_guest_token;

    return {
        "record": results.map(convert)[0],
        "token": jwt.sign(
            payload, JWT_Secret, options
        )
    };
}

/**
 * 获取游客历史令牌记录（颁布时间倒序）
 * 
 * @param {string} ip_address 地址
 * @param {number} count 每页数量 
 * @param {number} index 页码（从 1 开始）
 * @returns {GuestTokenRecord[]} 历史令牌记录
 */
export function get_guest_tokens(
    ip_address, count = 50, index = 1
) {
    if (!ip_address) return null;

    const record = operator.record();

    const options = {
        "paginate": {
            "limit": count,
            "offset": (index - 1) * count
        },

        "by": {
            "order": [
                "-created_at"
            ]
        }
    };

    const records = record.select(
        "guest_tokens", {
            "type": "unit",
            "column": "ip_address",
            "restrict": {
                "include": [
                    ip_address
                ]
            }
        }, options
    ).flat(3);

    const convert = convert_guest_token;

    return records.map(convert);
}

/**
 * @typedef {Object} GGRVC
 * @property {string} jti 游客令牌标识符
 * @property {Date} created_at 令牌创建时间
 * @property {Date} expired_at 令牌过期时间
 * 
 * @typedef {Object} GGRVCRFix
 * @property {number} answer 验证答案
 * @property {string} jti 令牌标识符
 * @property {number} code_id 验证码标识符
 * @property {boolean} is_invalid 是否失效
 * 
 * @typedef {Omit<(GGRVCRFix & GGRVC), "guest_token">} GGRVCRecord
 * 
 * @typedef {Object} GURVCResults
 * @property {Buffer} image 验证码图像
 * @property {GGRVCRecord} record 验证码记录
 */

/**
 * 转换验证码记录
 * 
 * @param {object} record 验证码记录
 * @returns {GGRVCRecord} 转换后的记录
 */
function convert_grv(record) {
    record.code_id = record.id;

    delete record.id;

    record.is_invalid = Boolean(record.is_invalid);

    record.created_at = new Date(record.created_at);
    record.expired_at = new Date(record.expired_at);

    return record;
}

/**
 * 检查 JWT 令牌并获取内容
 * 
 * @param {string} jwt_content JWT 令牌
 * @returns {object} 令牌内容
 */
export function check_jwt_token(jwt_content) {
    try {
        return jwt.verify(
            jwt_content, JWT_Secret, {
                "ignoreExpiration": true,
            }
        );
    } catch (e) {
        return "invalid";
    }
}

/**
 * 生成游客注册验证码
 * 
 * @param {GGRVC} verify_code 验证码
 * @param {GGRVC} defaults 默认值集合
 * @param {typeof default_merger} merger 属性合并器
 * @returns {GURVCResults} 结果集合
 */
export function generate_guest_register_verify_code(
    verify_code, defaults = {}, merger = default_merger,
    _write_table_name = "register_verify_codes"
) {
    if (!verify_code) return null;

    const current = merger(
        verify_code, defaults
    );

    const answer = parseInt(
        Math.random() * 1e6
    );

    const { expired_at, created_at } = current;

    const records = [ {
        "answer": answer,
        "jti": current.jti,
        "created_at": created_at.toISOString(),
        "expired_at": expired_at.toISOString()
    } ];

    const get_results = get_insert_results;

    const results = get_results(
        records, _write_table_name
    );

    const convert = convert_grv;

    return {
        "record": results.map(convert)[0],
        "image": generate_verify_code_image(answer)
    };
}

/**
 * 获取游客注册验证记录
 * 
 * @param {number} code_id 验证码标识符
 * @returns {GGRVCRecord} 验证码记录
 */
export function get_guest_register_verify_code(
    code_id, _read_table_name = "register_verify_codes"
) {
    if (!code_id) return null;

    const record = operator.record();

    const results = record.select(
        _read_table_name, {
            "type": "unit",
            "column": "id",
            "restrict": {
                "include": [
                    code_id
                ]
            }
        }
    );

    return results.map(convert_grv)[0];
}

/**
 * 令游客注册验证码失效
 * 
 * @param {number} code_id 验证码标识符
 * @returns {GGRVCRecord} 验证码记录
 */
export function revoke_guest_register_verify_code(
    code_id, _write_table_name = "register_verify_codes"
) {
    if (!code_id) return null;

    const get_results = get_update_results;

    const results = get_results({
        "type": "unit",
        "column": "id",
        "restrict": {
            "include": [
                code_id
            ]
        }
    }, _write_table_name, {
        "is_invalid": 1
    });

    return results.map(convert_grv)[0];
}

/**
 * 生成游客登陆账户验证码
 * 
 * @typedef {GGRVC} GLVC
 * 
 * @param {GLVC} verify_code 验证码
 * @param {GLVC} defaults 默认值集合
 * @param {typeof default_merger} merger 属性合并器
 * @returns {GURVCResults} 结果集合
 */
export function generate_login_verify_code(
    verify_code, defaults = {}, merger = default_merger
) {
    return generate_guest_register_verify_code(
        verify_code, defaults, merger, "login_verify_codes"
    );
}

/**
 * 获取账户登录验证记录
 * 
 * @param {number} code_id 验证码标识符
 * @returns {GGRVCRecord} 验证码记录
 */
export function get_login_verify_code(code_id) {
    return get_guest_register_verify_code(
        code_id, "login_verify_codes"
    );
}

/**
 * 令账户登录验证码失效
 * 
 * @param {number} code_id 验证码标识符
 * @returns {GGRVCRecord} 验证码记录
 */
export function revoke_login_verify_code(code_id) {
    return revoke_guest_register_verify_code(
        code_id, "login_verify_codes"
    );
}