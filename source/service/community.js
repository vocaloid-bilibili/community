import jwt from "jsonwebtoken";
import crypto from "node:crypto";
import { operator } from "../database/toolkit.js";

const HMAC_Key = process.env.VCS_HMAC_KEY;
const JWT_Secret = process.env.VCS_JWT_SECRET;
const RefreshTokenPrefix = "refresh-token-";

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
 * @param {object[]} records 需要出入的纪录列表
 * @param {string} table_name 需要出入的表的名称
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
 * @typedef {Object} RegisterUser
 * @property {string} username 账户名称
 * @property {string} nickname 用户昵称
 * @property {string} email 邮箱地址
 * @property {string} password 用户密码
 * @property {string} avatar 用户头像
 * @property {string} [description] 用户简介
 * @property {Date} [created_at] 创建时间
 * 
 * @typedef {Object} RUTFix
 * @property {string} password 经过HMAC处理的密码
 * @property {number} user_id 注册取得的用户数字标识符
 * @property {Date} created_at 账户创建时间
 * 
 * @typedef {(RegisterUser & RUTFix)} UserRecord
 */

/**
 * 注册用户
 * 
 * @param {RegisterUser} target 用户列表
 * @param {RegisterUser} defaults 默认值集合
 * @param {typeof default_merger} merger 属性合并器
 * @returns {UserRecord} 用户记录
 */
export function register_user(
    target, defaults = {}, merger = default_merger
) {
    if (!target) return null;

    const records = [];

    let { created_at } = target;

    created_at ??= defaults.created_at;

    const password = gen_hmac_password(
        target.password, created_at
    );

    const modified = {
        "password": password,
        "created_at": created_at.toISOString()
    };

    records.push(merger(target, {
        ...defaults, ...modified 
    }));

    const get_results = get_insert_results;

    const results = get_results(
        records, "users"
    );

    return results.map((result) => {
        result.user_id = result.id;

        delete result.id;

        result.created_at = new Date(
            result.created_at
        );

        return result;
    })[0];
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
        records, "tokens"
    );

    return results.map((result) => {
        result.token_id = result.id;

        delete result.id;

        result.created_at = new Date(
            result.created_at
        );
        result.expired_at = new Date(
            result.expired_at
        );

        return result;
    })[0];
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
        "iss": current.issuer || "vocabili-ca",
        "sub": "user_" + current.user_id,
        "aud": group_list.map((group) => {
            const { code } = user_group;

            return { code, "exp": group.expired_at ?
                get_ts(group.expired_at) : null
            };
        }),
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
 * @typedef {Object} RTRFix
 * @property {number} log_id 审计日志标识符
 * 
 * @typedef {(RevokeToken & RTRFix)} RevokeTokenRecord
 */

/**
 * 吊销刷新令牌
 * 
 * @param {RevokeToken} token 吊销列表
 * @param {RevokeToken} defaults 默认值集合
 * @param {typeof default_merger} merger 属性合并器
 * @returns {RevokeTokenRecord} 吊销记录
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

    return results.map((result) => ({
        "log_id": result.id,
        "token_id": result.target_id,
        "revoked_at": new Date(
            result.operated_at
        ),
        "revoker_id": result.operator_id,
        "reason_id": result.reason_id,
        "comments": result.comments
    }))[0];
}

/**
 * 通过刷新令牌标识符获取刷新令牌记录
 * 
 * @param {number} token_id 刷新令牌标识符列表
 * @returns {RefreshTokenRecord} 带有历史信息的刷新令牌
 */
export function get_refresh_token(token_id) {
    if (token_id === undefined) return null;

    const record = operator.record();

    const records = record.select(
        "tokens", {
            "type": "group",
            "relation": "and",
            "children": [
                {
                    "type": "unit",
                    "column": "id",
                    "restrict": {
                        "include": token_id
                    }
                }
            ]
        }
    ).flat(3);

    return records.map((record) => ({
        "token_id": record.id,
        "user_id": record.user_id,
        "content": record.content,
        "created_at": new Date(record.created_at),
        "expired_at": new Date(record.expired_at)
    }))[0];
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
 * @returns {RefreshTokenHistoryList} 带有历史信息的刷新令牌
 */
export function get_refresh_token_history_list_by_token_id(
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
 * @typedef {Object} CreateComment
 * @property {number} creator_id 创建者识别码
 * @property {number} page_id 所属页面标识符
 * @property {string} content 评论内容
 * @property {Date} created_at 创建时间
 * @property {Date} [modified_at] 修改时间
 * @property {("created"|"modified"|"deleted")} status 评论状态
 * @property {boolean} is_pinned 是否置顶
 * 
 * @typedef {Object} CommentPublicCount
 * @property {number} like_count 点赞数
 * @property {number} mark_count 收藏数
 * @property {number} dislike_count 反对数
 * 
 * @typedef {Object} CommentPublicTotalCount
 * @property {number} total_like_count 点赞数
 * @property {number} total_mark_count 收藏数
 * @property {number} total_dislike_count 反对数
 * 
 * @typedef {Object} CRFix_1
 * @property {number} reply_count 回复数
 * @property {number} comment_id 评论标识符
 * 
 * @typedef {(CommentPublicTotalCount & CommentPublicCount)} CRFix_2
 * 
 * @typedef {(CreateComment & CRFix_1 & CRFix_2)} CommentRecord
 */

/**
 * 创建评论
 * 
 * @param {CreateComment} comment 评论
 * @param {CreateComment} defaults 默认值集合
 * @param {typeof default_merger} merger 属性合并器
 * @returns {CommentRecord} 评论记录
 */
export function create_comment(
    comment, defaults = {}, merger = default_merger
) {
    if (!comment) return null;

    const records = [];

    const current = merger(comment, defaults);
    const { created_at, modified_at } = current;

    records.push({
        "creator_id": current.creator_id,
        "page_id": current.page_id,
        "content": current.content,
        "status": current.status,

        "is_pinned": +current.is_pinned,
        "created_at": created_at.toISOString(),
        "modified_at": current.modified_at ? 
            modified_at.toISOString() : null
    });

    const get_results = get_insert_results;

    const results = get_results(
        records, "comments"
    );

    return results.map((result) => {
        result.comment_id = result.id;

        delete result.id;

        result.counters = {
            "mark": result.mark_count,
            "like": result.like_count,
            "dislike": result.dislike_count,
            "reply": result.reply_count,

            "children": {
                "mark": result.children_mark_count,
                "like": result.children_like_count,
                "dislike": result.children_dislike_count
            }
        };

        delete result.mark_count;
        delete result.like_count;
        delete result.reply_count;
        delete result.dislike_count;

        delete result.total_mark_count;
        delete result.total_like_count;
        delete result.total_dislike_count;

        result.is_pinned = Boolean(
            result.is_pinned
        );
        result.created_at = new Date(
            result.created_at
        );
        result.modified_at = result.modified_at ?
            new Date(result.modified_at) : null;

        return result;
    })[0];
}

/**
 * @typedef {Object} CRFix_3
 * @property {number} comment_id 评论标识符
 * @property {number} parent_id 父级评论标识符
 * @property {number} root_id 顶级评论标识符
 * 
 * @typedef {Object} RRFix
 * @property {number} comment_id 评论标识符
 * 
 * @typedef {(CreateComment & CRFix_3)} CreateReply
 * @typedef {(CreateReply & RRFix & CommentPublicCount)} ReplyRecord
 */

/**
 * 创建回复
 * 
 * @param {CreateReply} reply 回复
 * @param {CreateReply} defaults 默认值集合
 * @param {typeof default_merger} merger 属性合并器
 * @returns {ReplyRecord} 回复记录
 */
export function create_reply(
    reply, defaults = {}, merger = default_merger
) {
    if (!comment) return null;

    const records = [];

    const current = merger(reply, defaults);
    const { created_at, modified_at } = current;

    records.push({
        "creator_id": current.creator_id,
        "page_id": current.page_id,
        "parent_id": current.parent_id,
        "root_id": current.root_id,
        "content": current.content,
        "status": current.status,

        "is_pinned": +current.is_pinned,
        "created_at": created_at.toISOString(),
        "modified_at": current.modified_at ? 
            modified_at.toISOString() : null
    });

    const get_results = get_insert_results;

    const results = get_results(
        records, "comments"
    );

    return results.map((result) => {
        result.comment_id = result.id;

        delete result.id;

        result.counters = {
            "mark": result.mark_count,
            "like": result.like_count,
            "dislike": result.dislike_count
        };

        delete result.mark_count;
        delete result.like_count;
        delete result.dislike_count;
        delete result.reply_count;
        delete result.total_mark_count;
        delete result.total_like_count;
        delete result.total_dislike_count;

        result.is_pinned = Boolean(
            result.is_pinned
        );
        result.created_at = new Date(
            result.created_at
        );
        result.modified_at = result.modified_at ?
            new Date(result.modified_at) : null;

        return result;
    })[0];
}

/**
 * @typedef {Object} CreatePage
 * @property {number} creator_id 创建者识别码
 * @property {string} name 评论区名称
 * @property {string} code 评论区代号
 * @property {string} [description] 描述
 * @property {Date} created_at 创建时间
 * @property {Date} [modified_at] 元数据修改时间
 * 
 * @typedef {Object} PRFix
 * @property {number} page_id 评论区标识符
 * 
 * @typedef {(CreatePage & PRFix)} PageRecord
 */

/**
 * 创建评论区
 * 
 * @param {CreatePage} page 评论区
 * @param {CreatePage} defaults 默认值集合
 * @param {typeof default_merger} merger 属性合并器
 * @returns {PageRecord} 评论区记录
 */
export function create_comment_page(
    page, defaults = {}, merger = default_merger
) {
    if (!page) return null;

    const records = [];

    const current = merger(page, defaults);
    const { created_at, modified_at } = current;

    const modified = {
        "created_at": created_at.toISOString(),
        "modified_at": current.modified_at ? 
            modified_at.toISOString() : null
    };

    records.push(merger(current, modified));

    const get_results = get_insert_results;

    const results = get_results(
        records, "comments"
    );

    return results.map((result) => {
        result.page_id = result.id;

        delete result.id;

        result.counters = {
            "current": result.current_count,
            "deleted": result.deleted_count,
            "total": result.total_count,
            "callback": result.callback_count
        };

        delete result.current_count;
        delete result.deleted_count;
        delete result.total_count;
        delete result.callback_count;

        result.is_pinned = Boolean(
            result.is_pinned
        );
        result.created_at = new Date(
            result.created_at
        );
        result.modified_at = result.modified_at ?
            new Date(result.modified_at) : null;

        return result;
    })[0];
}

/**
 * @typedef {Object} AddCommentReaction
 * @property {number} comment_id 评论标识符
 * @property {number} operator_id 操作者识别码
 * @property {Date} operated_at 操作时间
 * @property {("like"|"unlike"|"mark"|
 *  "unmark"|"dislike"|"undislike")} name 反应名称
 * @property {number} folder_id 所属文件夹
 * @property {string} [comments] 备注
 * 
 * @typedef {Object} CRRFix
 * @property {number} reaction_id 反应标识符
 * 
 * @typedef {(AddCommentReaction & CRRFix)} CommentReactionRecord
 */

/**
 * 对评论作出反应
 * 
 * @param {AddCommentReaction} reaction 评论标识符列表
 * @param {AddCommentReaction} defaults 操作者识别码
 * @param {typeof default_merger} merger 属性合并器
 * @returns {CommentReactionRecord} 反应记录
 */
export function add_comment_reaction(
    reaction, defaults = {}, merger = default_merger
) {
    if (!reaction) return null;

    const records = [];

    let { operated_at } = reaction;

    operated_at ??= defaults.operated_at;

    const modified = {
        "operated_at": operated_at.toISOString()
    };

    records.push(merger(current, {
        ...defaults, ...modified 
    }));

    const get_results = get_insert_results;

    const results = get_results(
        records, "comment_reactions"
    );

    return results.map((result) => {
        result.reaction_id = result.id;

        delete result.id;

        result.operated_at = new Date(
            result.operated_at
        );

        return result;
    })[0];
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
 * 
 * @typedef {(CreateGroup & GRFix)} GroupRecord
 */

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

    return results.map((result) => {
        result.group_id = result.id;

        delete result.id;

        result.counters = {
            "member": result.member_count
        };

        delete result.member_count;

        result.created_at = new Date(
            result.created_at
        );
        result.modified_at = result.modified_at ?
            new Date(result.modified_at) : null;

        return result;
    })[0];
}

/**
 * 获取用户组信息
 * 
 * @param {number[]} group_id 需要获取的用户组标识符
 * @returns {GroupRecord[]} 用户组记录
 */
export function get_user_group(group_id) {
    const record = operator.record();

    const records = record.select(
        "user_groups", {
            "type": "group",
            "relation": "and",
            "children": [
                {
                    "type": "unit",
                    "column": "id",
                    "restrict": {
                        "include": [ group_id ]
                    }
                }
            ]
        }
    ).flat(3);

    return records.map((result) => {
        result.group_id = result.id;

        delete result.id;

        result.counters = {
            "member": result.member_count
        };

        delete result.member_count;

        result.created_at = new Date(
            result.created_at
        );
        result.modified_at = result.modified_at ?
            new Date(result.modified_at) : null;

        return result;
    })[0];
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
 * @property {AddUserToGroupAuditLog} audits 操作日志
 * @property {MemberGroupRelationRecord} relations 成员关系记录
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

    return {
        "audits": result_lists.operate_audit_logs.map((record) => {
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

        "relations": result_lists.group_users.map((record) => ( {
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
 * 添加用户到用户组
 * 
 * @typedef {Object} RemoveU4GResults
 * @property {RemoveUserFromGroupAuditLog} audits 操作日志
 * @property {MemberGroupRelationRecord} relations 成员关系记录
 * 
 * @param {RemoveU4G} behavior 添加行为列表
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
    const { comments, reason_id, ...create } = current;
    const { operated_at } = create;

    const modified = {
        "operated_at": operated_at.toISOString()
    };

    record_lists.update.push(
        merger(create, modified)
    );

    record_lists.insert.push({
        "operate_type": "remove-user-form-group",
        "target_id": create.user_id,
        "target_type": "user",
        "operator_id": create.operator_id,
        "reason_id": reason_id,
        "comments": comments,
        "operated_at": modified.operated_at,
        "extra_info": JSON.stringify({
            "target_group": create.group_id
        }),
    });

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

        "relations": result_lists.group_users.map((record) => ( {
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
 * 根据用户标识符获取所属的用户组信息
 * 
 * @param {number} user_id 用户标识符
 * @param {number} count 每页用户组数
 * @param {number} index 当前页索引（从 1 开始）
 * @returns {MemberGroupRelationRecord} 用户组信息
 */
export function get_group_list_by_user_id(
    user_id, count = 50, index = 1
) {
    if (!user_id) return null;

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
                        "include": [ user_id ]
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

    return records.map(record => ({
        "member_id": record.id,
        "user_id": record.user_id,
        "group_id": record.group_id,
        "status": record.status,
        "expired_at": record.expired_at ?
            new Date(record.expired_at) : null,
        "operated_at": new Date(record.operated_at),
        "operator_id": record.operator_id
    }));
}