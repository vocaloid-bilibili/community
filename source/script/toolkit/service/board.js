const where = {
    "type": "group",
    "relation": "and",
    "children": [
        {
            "type": "unit",
            "column": "operator_id",
            "restrict": {
                "include": [operator_id]
            }
        },

        {
            "type": "unit",
            "column": "comment_id",
            "restrict": {
                "include": comment_ids
            }
        }
    ]
};