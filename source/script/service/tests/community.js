import * as community from "../community.js";

// console.time("注册 16 个测试账户");

// community.register_users(Array.from({ length: 16 }).map((_, index) => ({
//     "username": "test" + (index + 1).toString().padStart(4, "0"),
//     "nickname": "Test " + (index + 1).toString().padStart(4, "0"),
//     "email": "test-" + (index + 1).toString().padStart(4, "0") + "@example.com",
//     "password": "test-user-" + (index + 1).toString().padStart(4, "0"),
//     "avatar": "inner-resource://avatar/default/1",
//     "description": "This is #" + (index + 1).toString().padStart(4, "0") + " test user.",
// })), { "created_at": new Date() });

// console.timeEnd("注册 16 个测试账户");

// console.log(community.create_user_groups([
//     { "code": "test-group2", "name": "测试群组2", "description": "这是一个测试群组",
//         "created_at": new Date(), "creator_id": 2 },
//     { "code": "test-group3", "name": "测试群组3", "description": "这是一个测试群组",
//         "created_at": new Date(), "creator_id": 3 }
// ]));

// console.log(community.add_users_to_groups([
//     { "group_id": 3, "user_id": 1, "reason_id": 1, "operated_at": new Date(), "operator_id": 1 }
// ]))

// console.log(community.get_group_list_by_user_ids([1])[0]);

console.log(community.generate_access_token([{
    "user_id": 1, "created_at": new Date(), "expired_at": new Date(Date.now() + 60 * 60 * 1000)
}]))