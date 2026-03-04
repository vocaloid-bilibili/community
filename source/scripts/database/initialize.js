import * as community from "../../service/community.js";

community.register_user({
    "$user_id": 10000,
    "nickname": "社区系统",
    "username": "community-system",
    "email": "system@vocabili.top",
    "password": "community-system-password",
    "created_at": new Date(),
    "description": "这是一个初始用户。"
});