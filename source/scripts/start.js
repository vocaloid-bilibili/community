import cors from "cors";
import express from "express";
import * as community from "../service/community.js";
import config from "../../config.json" with { type: "json" };

const app = express();

const { servive: service } = config;

app.use(cors(service.cors));

const address = `http://${service.host}:${service.port}/`;

const server = app.listen(
    service.port, service.host, (error) => {
        if (error !== undefined) {
            console.error(error);

            throw new Error(`在 ${address} 上启动服务时遇到错误：`,
                { "cause": "服务提供器监听指定端口失败" });
        }

        console.log(`成功在 ${address} 上启用 Community 服务`);
    }
);

server.on("error", (error) => {
    console.log("服务器在执行 JavaScript 脚本文件时遇到未捕获错误", error);
});

app.get("/random/guest-verify-code-image", (_, response) => {
    response.setHeader("Content-Type", "image/png");

    const method = "generate_verify_code_image";

    return response.send(community[method](
        parseInt(Math.random() * 1e6)
    ));
});

const durations = {
    "guest_token": 5 * 60 * 1000,
    "guest_verify_code": 5 * 60 * 1000
};

app.get("/guest/token", (request, response) => {
    const now_ts = Date.now();

    const method = [];

    const ip_address = request.
        socket.remoteAddress;

    method[0] = "get_guest_tokens";

    const history = community[method[0]](
        request.socket.remoteAddress, 1, 1
    );

    history[0] ??= { "expired_at": new Date(0) };

    if (history[0].expired_at > now_ts) {
        return response.send({
            "status": "failure",
            "code": "token_not_expired",
            "message": "最新访客令牌尚未过期"
        });
    }

    method[1] = "generate_guest_token";

    const duration = durations["guest_token"];

    const results = community[method[1]]({
        "ip_address": ip_address,
        "created_at": new Date(now_ts),
        "expired_at": new Date(
            now_ts + duration
        ),
    });

    return response.send({
        "token": results.token,
        "time": new Date(now_ts),
        "ip_address": ip_address,
        "expired_at": new Date(
            now_ts + duration
        ),
        "status": "success"
    });
});

app.use((request, response, next) => {
    const now_ts = Date.now();

    const jwt_token = request.
        headers.authorization?.
        replace("Bearer ", "");

    if (!jwt_token) {
        return response.send({
            "status": "failure",
            "code": "no_auth_header",
            "msg": "请提供 Auth 标头"
        });
    }

    const methods = [];

    methods[0] = "check_jwt_token";

    const token = community
        [methods[0]](jwt_token);

    if (token === "invalid") {
        return response.send({
            "status": "failure",
            "code": "invalid_token",
            "msg": "无效的令牌"
        });
    }

    if (token.type === "guest") {
        const ip_address = request.
            socket.remoteAddress;

        if (ip_address !== token.ip) {
            return response.send({
                "status": "failure",
                "code": "ip_address_mismatch",
                "msg": "令牌签发地址与当前地址不匹配"
            });
        }
    }

    if (token.exp < now_ts / 1000) {
        return response.send({
            "status": "failure",
            "code": "token_expired",
            "msg": "令牌已过期"
        });
    }

    request.token = token;

    next();
});

/**
 * 判断一个字符串是否为正整数
 * 
 * @param {string} text 需要检查的字符串 
 * @returns {boolean} 是否为正整数
 */
function is_positive_integer_like(text) {
    if (typeof text !== "string") {
        return false;
    }

    return /^[1-9]\d*$/.test(text);
}

const regexs = {
    "test": {
        "username": /^[a-zA-Z0-9\-_]$/,
        "nickname": /\p{Cf}/u,
        "email": /^[\w-]+(\.[\w-]+)*@[\w-]+(\.[\w-]+)+$/
    }
};

app.post("/register/user", (request, response) => {
    const now_ts = Date.now();

    const { token } = request;

    if (token.type !== "guest") {
        return response.send({
            "status": "failure",
            "code": "invalid_token_type",
            "msg": "无效的令牌类型"
        });
    }

    const params = request.query;

    if (!params.code_id) {
        return response.send({
            "status": "failure",
            "code": "no_code_id",
            "msg": "请提供验证码标识符"
        });
    }

    if (!params.code_answer) {
        return response.send({
            "status": "failure",
            "code": "no_code_answer",
            "msg": "请提供验证码答案"
        });
    }

    if (is_positive_integer_like(
        params.code_id
    )) return response.send({
        "status": "failure",
        "code": "invaild_code_id",
        "msg": "无效的验证码标识符"
    });

    if (is_positive_integer_like(
        params.code_answer
    )) return response.send({
        "status": "failure",
        "code": "invaild_code_answer",
        "msg": "无效的验证码答案"
    });

    const methods = [
        "get_guest_register_verify_code"
    ];

    const code = community[methods[0]](
        parseInt(params.code_id)
    );

    if (!code) {
        return response.send({
            "status": "failure",
            "code": "invaild_code_id",
            "msg": "目标验证码不存在"
        });
    }

    if (code.jti !== token.jti) {
        return response.send({
            "status": "failure",
            "code": "mismatch_token",
            "msg": "验证码归属不匹配"
        });
    }

    if (code.is_invalid) {
        return response.send({
            "status": "failure",
            "code": "invalid_code",
            "msg": "目标验证码已失效"
        });
    }

    if (code.expired_at < now_ts) {
        return response.send({
            "status": "failure",
            "code": "expired_code",
            "msg": "目标验证码已过期"
        });
    }

    if (code.answer != params.code_answer) {
        const method = "revoke_guest" +
            "_register_verify_code";

        community[method](code.id);

        return response.send({
            "status": "failure",
            "code": "invaild_code_answer",
            "msg": "目标验证码答案不正确"
        });
    }

    const tests = regexs.test;

    if (!params.username) {
        return response.send({
            "status": "failure",
            "code": "no_username",
            "msg": "请提供用户名"
        });
    }

    const { username } = params;


    if (tests.username.test(username)) {
        return response.send({
            "status": "failure",
            "code": "invaild_username",
            "msg": "无效的账户名"
        });
    }

    if (!params.nickname) {
        return response.send({
            "status": "failure",
            "code": "no_nickname",
            "msg": "请提供昵称"
        });
    }

    const { nickname } = params;

    if (tests.nickname.test(nickname)) {
        return response.send({
            "status": "failure",
            "code": "invaild_nickname",
            "msg": "无效的昵称"
        });
    }

    if (!params.password) {
        return response.send({
            "status": "failure",
            "code": "no_password",
            "msg": "请提供密码"
        });
    }

    if (!params.email) {
        return response.send({
            "status": "failure",
            "code": "no_email",
            "msg": "请提供邮箱"
        });
    }

    const { email } = params;

    if (tests.email.test(email)) {
        return response.send({
            "status": "failure",
            "code": "invaild_email",
            "msg": "无效的邮箱"
        });
    }

    if (params.description) {
        const { description } = params;

        if (description.length > 255) {
            return response.send({
                "status": "failure",
                "code": "invaild_description_length",
                "msg": "个人简介长度过长"
            });
        }
    }

    methods[1] = "get_user_list_by_fields";

    if (community[methods[1]]({
        "field": "username",
        "values": [ username ]
    }).length) {
        return response.send({
            "status": "failure",
            "code": "username_exist",
            "msg": "用户名已存在"
        });
    }

    if (community[methods[1]]({
        "field": "email",
        "values": [ email ]
    }).length) {
        return response.send({
            "status": "failure",
            "code": "email_exist",
            "msg": "邮箱已被占用"
        });
    }

    methods[1] = "register_user";

    const result = community[methods[1]]({
        "created_at": new Date(now_ts),
        "description": params.description,
        "email": params.email,
        "nickname": params.nickname,
        "password": params.password,
        "username": params.username
    });

    return response.send({
        "status": "success",
        "data": {
            "user_id": result.user_id,
            "created_at": new Date(now_ts)
        },
        "msg": "账户注册成功"
    });
});

app.get("/guest/verify-code", (request, response) => {
    const now_ts = Date.now();

    const duration = durations["guest_verify_code"];

    const method = [
        "generate_guest_register_verify_code"
    ];

    const results = community[method[0]]({
        "jti": request.token.jti,
        "created_at": new Date(now_ts),
        "expired_at": new Date(
            now_ts + duration
        )
    });

    const text = results.image.toString("base64");

    return response.send({
        "data": {
            "image": "data:image/png;base64," + text,
            "code_id": results.record.code_id
        },
        "status": "success"
    });
});

app.get("/user/token/access", (request, response) => {
    const now_ts = Date.now();

});

app.get("/user/token/refresh", (request, response) => {
    const now_ts = Date.now();


});

/**
 * 
 * @typedef {Object} Audience
 * @property {string} code 用户组标识符
 * @property {number} exp 分组过期时间
 * 
 * @typedef {Parameters<Parameters<
 *  app["get"]>[1]>[1]} Response
 * 
 * @param {Audience[]} aud 用户组
 * @param {Response} response 响应
 * @returns 检查结果
 */
function check_admin(aud, response) {
    const admin = aud.findLast(
        ({ code }) => code === "admin"
    );

    if (admin === undefined) {
        return response.send({
            "status": "failure",
            "code": "permission_denied",
            "msg": "权限不足"
        });
    }

    if (admin.exp < now_ts / 1000) {
        return response.send({
            "status": "failure",
            "code": "admin_expired",
            "msg": "管理员身份已过期"
        });
    }

    return "pass";
}

app.delete("/user/token/refresh", (request, response) => {
    const now_ts = Date.now();

    const { token } = request;

    if (token.type !== "user") {
        return response.send({
            "status": "failure",
            "code": "invalid_token_type",
            "msg": "无效的令牌类型"
        });
    }

    const { aud } = token;

    if (check_admin(
        aud, response
    ) !== "pass") {
        return;
    }

    const { query } = request;

    if (!query.reason_id) {
        return response.send({
            "status": "failure",
            "code": "no_reason_id",
            "msg": "请提供原因数字标识符"
        });
    }

    if (is_positive_integer_like(
        query.reason_id
    )) return response.send({
        "status": "failure",
        "code": "invalid_reason_id",
        "msg": "无效的原因数字标识符"
    });

    if (!query.token_id) {
        return response.send({
            "status": "failure",
            "code": "no_token_id",
            "msg": "请提供刷新令牌标识符"
        });
    }

    if (is_positive_integer_like(
        query.token_id
    )) return response.send({
        "status": "failure",
        "code": "invalid_token_id",
        "msg": "无效的刷新令牌标识符"
    });

    const { sub } = token;
    const user_id = +sub.slice(
        sub.indexOf("_") + 5
    );

    const methods = [
        "revoke_refresh_token"
    ];

    const result = community[methods[0]]({
        "reason_id": +query.reason_id,
        "revoked_at": new Date(now_ts),
        "revoker_id": user_id,
        "token_id": +query.token_id
    });

    return response.send({
        "status": "success",
        "data": {
            "log_id": result.audit.log_id,
            "revoked_at": result.audit.revoked_at
        },
        "msg": "刷新令牌吊销成功"
    });
});

app.patch("/user/:user_id/:field_name", (request, response, next) => {
    const now_ts = Date.now();

    if (!request.params.user_id.trim()) {
        return response.send({
            "status": "failure",
            "code": "no_user_id",
            "msg": "请提供用户标识符"
        });
    }

    if (is_positive_integer_like(
        request.params.user_id
    )) return response.send({
        "status": "failure",
        "code": "invalid_user_id",
        "msg": "无效的用户标识符"
    });

    const { params } = request;

    if (!params.field_name.trim()) {
        return response.send({
            "status": "failure",
            "code": "no_field_name",
            "msg": "请提供字段名称"
        });
    }

    const field = params.field_name.toLowerCase(0);

    if (field === "email" || field === "password") {
        return next();
    }

    const list = [
        "username", "nickname"
    ];

    if (!list.includes(field)) {
        return response.send({
            "status": "failure",
            "code": "invalid_field_name",
            "msg": "无效的字段名称"
        });
    }

    const { token } = request;
    
    const { aud, sub } = token;
    const user_id = +sub.slice(
        sub.indexOf("_") + 5
    );

    if (user_id !== +params.user_id) {
        if (check_admin(
            aud, response
        ) !== "pass") {
            return;
        }
    }

    const methods = [
        "update_user_infocard"
    ];

    const results = community[methods[0]]({
        "field_name": field,
        "operated_at": new Date(now_ts),
        "operator_id": user_id,
        "user_id": +params.user_id,
        "new_value": request.query.value
    });

    return response.send({
        "status": "success",
        "data": {
            "change_id": results.change.change_id,
            "changed_at": results.change.operated_at
        },
        "msg": "用户信息卡片更新成功"
    });
})