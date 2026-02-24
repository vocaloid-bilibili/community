# 新后端接口开发

## 通用接口

- default_merger $\checkmark$

## 社区系统后端接口

### 用户子模块

- register_users $\checkmark$
- freeze_users $\checkmark$
- unfreeze_users $\checkmark$
- delete_users $\checkmark$

- profiles $\checkmark$
    - get_hmac_password $\checkmark$

    - update_values $\checkmark$
        - update_usernames $\checkmark$
        - update_nicknames $\checkmark$
        - update_emails $\checkmark$
        - update_passwords $\checkmark$
        - update_avatars $\checkmark$
        - update_descriptions $\checkmark$

    - get_users $\checkmark$

- user_groups
    - create_user_groups $\checkmark$
    - remove_user_groups $\checkmark$
    - members $\checkmark$
        - add_group_members $\checkmark$
        - remove_group_members $\checkmark$
        - update_group_members $\checkmark$

- refresh_tokens $\checkmark$
    - create_refresh_tokens $\checkmark$
    - revoke_refresh_tokens $\checkmark$
    - get_refresh_tokens $\checkmark$

- access_tokens $\checkmark$
    - create_access_tokens $\checkmark$

### 评论子模块

- create_comments $\checkmark$
- create_replies $\checkmark$
- likes $\checkmark$
    - like_comments $\checkmark$
    - delete_like_comments $\checkmark$
    - dislike_comments $\checkmark$
    - undislike_comments $\checkmark$
    - get_comment_like_lists $\checkmark$