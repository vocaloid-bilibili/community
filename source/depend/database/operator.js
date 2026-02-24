import SQLite3 from "better-sqlite3";

import * as ViewModel from "./model/view.js";
import * as ToolModel from "./model/tool.js";
import * as IndexModel from "./model/index.js";
import * as TableModel from "./model/table.js";
import * as RecordModel from "./model/record.js";
import * as PragmaModel from "./model/pragma.js";
import * as TriggerModel from "./model/trigger.js";
import * as SavepointModel from "./model/point.js";
import * as StatementModel from "./model/statement.js";
import * as TransactionModel from "./model/transaction.js";

const get_generator = () => ({
    "view": ViewModel,
    "tool": ToolModel,
    "index": IndexModel,
    "point": SavepointModel,
    "pragma": PragmaModel,
    "table": TableModel,
    "record": RecordModel,
    "trigger": TriggerModel,
    "statement": StatementModel,
    "transaction": TransactionModel
});

const ster = () => value => value;
const rter = value => () => value;

/**
 * SQLite 数据库操作类
 * 
 * @class
 * @typedef {DatabaseOperator} DbOpor
 * 
 * @license MIT
 * @version 1.0.0
 * @author ETeyondLilte0721 <eteyondlilte@gmail.com>
 */
export class DatabaseOperator {
    /**
     * 创建数据库操作实例
     * 
     * @constructor
     * 
     * @param {Function} passer SQL 语句处理器传递函数
     * @param {SQLite3.Database} instance 数据库实例
     * @returns {DatabaseOperator} 数据库操作实例
     */
    constructor(instance = new SQLite3(), passer = rter()) {
        this.handler = {
            "build": rter(),
            "passer": [ passer ],
        };
        this.instance = instance;
        this.generator = get_generator();

         /**
         * 预编译语句缓存
         * @type {Map<string, SQLite3.Statement>}
         */
        this.sentence = new Map();
    }

    /**
     * 执行 SQL 语句
     * 
     * @private
     * 
     * @param {object} options 语句执行选项
     * @returns 执行结果
     */
    #execute(options) {
        options.handler ??= ster();

        const { parameter = {} } = options;

        const { action, handler, sentence } = options;

        if (!this.sentence.has(sentence)) {
            const prepare = this.instance.prepare(sentence);

            this.sentence.set(sentence, prepare);
        }

        const prepare = this.sentence.get(sentence);

        const _run = (getter, parameters) => {
            const keys = Object.keys(parameters);
            const result = [], length = keys.length;

            if (length === 0) {
                return [ getter() ];
            }

            if (!Array.isArray(parameters)) {
                parameters = [ parameters ];
            }

            for (const current of parameters) {
                result.push(getter(current));
            }

            return result;
        };

        const executor = {
            "single": prepare.get,
            "request": prepare.run,
            "execute": prepare.all,
            "iterate": prepare.iterate
        } [ action ];

        const getter = executor.bind(prepare);

        const result = _run(
            getter, parameter
        );

        return handler(result);
    }

    /**
     * 内部处理 SQL 生成和执行流程
     * 
     * @private
     * 
     * @param {Function} generator SQL 生成器函数
     * @param {Array} input_args 生成器参数
     * @param {Function} reviewer 结果审查函数
     * @returns {any} 执行结果
     */
    #process(generator, input_args = [], reviewer) {
        reviewer ??= ster();
        
        let product = generator(
            ...input_args
        );

        if (!Array.isArray(product)) {
            product = [ product ];
        }

        this.handler.passer.forEach(
            handler => handler(product)
        );

        product = reviewer(product) || [];

        const result = [];

        for (let index = 0; index < product.length; index++) {
            const current = product[index];

            result.push(this.#execute(current));
        }

        return result;
    } 

    /**
     * 创建一个表单
     * 
     * @param {string} table 表单名称
     * @param {object} options 创建表单配置
     * @param {Function} reviewer 语句生成结果审查函数
     * @returns 执行结果
     */
    create_table(table, options, reviewer) {
        options ??= {};

        const { table: _table } = this.generator;

        const handler = _table.create;

        const args = [ table, options ];

        return this.#process(
            handler, args, reviewer
        );
    }

    /**
     * 删除一个已存在的表单
     * 
     * @param {string} table 表单名称
     * @param {object} options 删除表单配置
     * @param {Function} reviewer 语句生成结果审查函数
     * @returns 执行结果
     */
    remove_table(table, options, reviewer) {
        options ??= {};

        const { table: _table } = this.generator;

        const handler = _table.remove;

        const args = [ table, options ];

        return this.#process(
            handler, args, reviewer
        );
    }

    /**
     * 更新一个已存在的表单
     * 
     * @param {string} table 表单名称
     * @param {object} options 更新表单配置
     * @param {Function} reviewer 语句生成结果审查函数
     * @returns 执行结果
     */
    alter_table(table, options, reviewer) {
        options ??= {};

        const { table: _table } = this.generator;

        const handler = _table.alter;

        const args = [ table, options ];

        return this.#process(
            handler, args, reviewer
        );
    }

    /**
     * 批量插入项目到指定记录
     * 
     * @param {string} table 表单名称
     * @param {object[]} dataset 需要插入的记录的数据集
     * @param {object} options 构建语句时使用的配置
     * @param {Function} reviewer 语句生成结果审查函数
     * @returns 执行结果
     */
    insert_record(table, dataset, options, reviewer) {
        options ??= {};

        options.mode ??= "batch";

        const record = this.generator.record;
        const handler = record.insert[options.mode];

        const args = [ table, dataset, options ];

        return this.#process(
            handler, args, reviewer
        );
    }

    /**
     * 删除一个已存在的记录
     * 
     * @param {string} table 表单名称
     * @param {object} where 删除条目的条件
     * @param {Function} reviewer 语句生成结果审查函数
     * @returns 执行结果
     */
    delete_record(table, where, reviewer) {
        where ??= {};

        const { record } = this.generator;

        const handler = record.delete;

        const args = [ table, where ];

        return this.#process(
            handler, args, reviewer
        );
    }

    /**
     * 更新一个已存在的记录
     * 
     * @param {string} table 表单名称
     * @param {object} where 更新条目的条件
     * @param {object} data 更新后的数据
     * @param {object} options 构建语句时使用的配置
     * @param {Function} reviewer 语句生成结果审查函数
     * @returns 执行结果
     */
    update_record(table, where, data, options, reviewer) {
        where ??= {};

        const { record } = this.generator;

        const handler = record.update;

        const args = [ table, where, data, options ];

        return this.#process(
            handler, args, reviewer
        );
    }

    /**
     * 查询已存在的记录
     * 
     * @param {string} table 表单名称
     * @param {object} where 查询条件
     * @param {object} options 查询配置
     * @param {Function} reviewer 语句生成结果审查函数
     * @returns 执行结果
     */
    select_record(table, where, options, reviewer) {
        where ??= {}, options ??= {};

        options.mode ??= "regular";

        const record = this.generator.record;

        let handler = record.select[options.mode];

        handler = handler.bind(record.select);

        const args = [ table, where, options ];

        return this.#process(
            handler, args, reviewer
        );
    }

    /**
     * 查询已存在的记录
     * 
     * @param {any[][]} params_list 查询参数的列表列表
     * @param {object} options 查询配置
     * @param {Function} reviewer 语句生成结果审查函数
     * @returns 执行结果
     */
    select_record_union(params_list, options, reviewer) {
        options ??= {};
        options.mode ??= "regular";

        const record = this.generator.record;

        let handler = record.selects[options.mode];

        handler = handler.bind(record.select);

        const args = [ params_list, options ];

        return this.#process(
            handler, args, reviewer
        );
    }

    /**
     * 查询已存在且符合条件的记录的数量
     * 
     * @param {string} table 表单名称
     * @param {object} where 查询条件
     * @param {Function} reviewer 语句生成结果审查函数
     * @returns {number} 执行结果
     */
    count_record(table, where, reviewer) {
        where ??= {};

        const { record } = this.generator;

        const handler = record.count;

        const args = [ table, where ];

        return this.#process(
            handler, args, reviewer
        );
    }
    
    /**
     * 创建一个索引
     * 
     * @param {string} table 所属表单
     * @param {string} index 索引名称
     * @param {object} options 创建索引时使用的配置
     * @param {Function} reviewer 语句生成结果审查函数
     * @returns 执行结果
     */
    create_index(table, index, options, reviewer) {
        options ??= {};

        const { index: _index } = this.generator;

        const handler = _index.create;

        const args = [ table, index, options ];

        return this.#process(
            handler, args, reviewer
        );
    }

    /**
     * 删除一个已存在的索引
     * 
     * @param {string} table 所属表单
     * @param {string} index 索引名称
     * @param {object} options 删除索引时使用的配置
     * @param {Function} reviewer 语句生成结果审查函数
     * @returns 执行结果
     */
    remove_index(table, index, options, reviewer) {
        options ??= {};

        const { index: _index } = this.generator;

        const handler = _index.remove;

        const args = [ table, index, options ];

        return this.#process(
            handler, args, reviewer
        );
    }

    /**
     * 创建一个视图
     * 
     * @param {string} name 视图名称
     * @param {string} table 所属表单
     * @param {object} where 进入视图的条件
     * @param {object} options 构建条件的配置
     * @param {Function} reviewer 语句生成结果审查函数
     * @returns 执行结果
     */
    create_view(name, table, where, options, reviewer) {
        options ??= {};

        const { view } = this.generator;

        const handler = view.create;

        const args = [ name, table, where, options ];

        return this.#process(
            handler, args, reviewer
        );
    }

    /**
     * 删除一个已经存在的视图
     * 
     * @param {string} name 视图名称
     * @param {object} options 删除视图时使用的配置
     * @param {Function} reviewer 语句生成结果审查函数
     * @returns 执行结果
     */
    remove_view(name, options, reviewer) {
        options ??= {};

        const { view } = this.generator;

        const handler = view.remove;

        const args = [ name, options ];

        return this.#process(
            handler, args, reviewer
        );
    }

    /**
     * 删除一个已经存在的触发器
     * 
     * @param {string} name 触发器名称
     * @param {object} options 删除触发器时使用的配置
     * @param {Function} reviewer 语句生成结果审查函数
     * @returns 执行结果
     */
    remove_trigger(name, options, reviewer) {
        options ??= {};

        const { trigger } = this.generator;

        const handler = trigger.remove;

        const args = [ name, options ];

        return this.#process(
            handler, args, reviewer
        );
    }

    /**
     * 创建一个保存点
     * 
     * @param {string} name 保存点名称
     * @param {Function} reviewer 语句生成结果审查函数
     * @returns 执行结果
     */
    create_point(name, reviewer) {
        const { point } = this.generator;

        const handler = point.create;

        const args = [ name ];

        return this.#process(
            handler, args, reviewer
        );
    }

    /**
     * 释放一个保存点
     * 
     * @param {string} name 保存点名称
     * @param {Function} reviewer 语句生成结果审查函数
     * @returns 执行结果
     */
    release_point(name, reviewer) {
        const { point } = this.generator;

        const handler = point.release;

        const args = [ name ];

        return this.#process(
            handler, args, reviewer
        );
    }

    /**
     * 回滚到一个保存点
     * 
     * @param {string} name 保存点名称
     * @param {Function} reviewer 语句生成结果审查函数
     * @returns 执行结果
     */
    rollback_point(name, reviewer) {
        const { point } = this.generator;

        const handler = point.rollback;

        const args = [ name ];

        return this.#process(
            handler, args, reviewer
        );
    }

    /**
     * 开始一个事务
     * 
     * @param {Function} reviewer 语句生成结果审查函数
     * @returns 执行结果
     */
    begin_transaction(options, reviewer) {
        options ??= {};

        const { transaction } = this.generator;

        const handler = transaction.begin;

        const args = [ options ];

        return this.#process(
            handler, args, reviewer
        );
    }

    /**
     * 提交一个事务
     * 
     * @param {Function} reviewer 语句生成结果审查函数
     * @returns 执行结果
     */
    commit_transaction(reviewer) {
        const { transaction } = this.generator;

        const handler = transaction.commit;

        return this.#process(
            handler, [], reviewer
        );
    }

    /**
     * 回滚一个事务
     * 
     * @param {Function} reviewer 语句生成结果审查函数
     * @returns 执行结果
     */
    rollback_transaction(reviewer) {
        const { transaction } = this.generator;

        const handler = transaction.rollback;

        return this.#process(
            handler, [], reviewer
        );
    }

    /**
     * 备份数据库
     * 
     * @param {string} filepath 备份文件路径
     * @param {Function} reporter 进度回调
     * @returns 执行结果
     */
    backup_database(filepath, reporter) {
        const instance = this.instance;

        reporter ??= () => {};

        return instance.backup(filepath, {
            "progress": reporter
        });
    }

    /**
     * 清空数据库中的被删除的数据
     * 
     * @param {Function} reviewer 语句生成结果审查函数
     * @returns 执行结果
     */
    vacuum_database() {
        const { pragma } = this.generator;

        const run = pragma.run;

        const handler = run.vacuum;

        return this.#process(
            handler, [], reviewer
        );
    }

    /**
     * 优化数据库
     * 
     * @param {Function} reviewer 语句生成结果审查函数
     * @returns 执行结果
     */
    optimize_database() {
        const { pragma } = this.generator;

        const run = pragma.run;

        const handler = run.optimize;

        return this.#process(
            handler, [], reviewer
        );
    }

    /**
     * 检查数据库完整性
     * 
     * @param {Function} reviewer 语句生成结果审查函数
     * @returns 执行结果
     */
    check_database() {
        const { pragma } = this.generator;

        const run = pragma.run;

        const handler = run.integrity_check;

        return this.#process(
            handler, [], reviewer
        );
    }

    /**
     * 关闭数据库连接
     * 
     * @returns 执行结果
     */
    close_database() {
        return this.instance.close();
    }

    /**
     * 获取数据库的日志模式
     * 
     * @param {Function} reviewer 语句生成结果审查函数
     * @returns 执行结果
     */
    get_journal_mode_config(reviewer) {
        const { pragma } = this.generator;

        const get = pragma.get;

        const handler = get.journal_mode;

        return this.#process(
            handler, [], reviewer
        );
    }

    /**
     * 获取数据库与文件系统的数据同步强度
     * 
     * @param {Function} reviewer 语句生成结果审查函数
     * @returns 执行结果
     */
    get_synchronous_config(reviewer) {
        const { pragma } = this.generator;

        const get = pragma.get;

        const handler = get.synchronous;

        return this.#process(
            handler, [], reviewer
        );
    }

    /**
     * 获取外键约束启用状态
     * 
     * @param {Function} reviewer 语句生成结果审查函数
     * @returns 执行结果
     */
    get_foreign_keys_config(reviewer) {
        const { pragma } = this.generator;

        const get = pragma.get;

        const handler = get.foreign_keys;

        return this.#process(
            handler, [], reviewer
        );
    }

    /**
     * 获取临时表存储配置
     * 
     * @param {Function} reviewer 语句生成结果审查函数
     * @returns 执行结果
     */
    get_temp_store_config(reviewer) {
        const { pragma } = this.generator;

        const get = pragma.get;

        const handler = get.temp_store;

        return this.#process(
            handler, [], reviewer
        );
    }

    /**
     * 获取数据库的忙碌重试超时时间（单位：毫秒）
     * 
     * @param {Function} reviewer 语句生成结果审查函数
     * @returns 执行结果
     */
    get_busy_timeout_config(reviewer) {
        const { pragma } = this.generator;

        const get = pragma.get;

        const handler = get.busy_timeout;

        return this.#process(
            handler, [], reviewer
        );
    }

    /**
     * 获取数据库的缓存大小（单位：页）
     * 
     * @param {Function} reviewer 语句生成结果审查函数
     * @returns 执行结果
     */
    get_cache_size_config(reviewer) {
        const { pragma } = this.generator;

        const get = pragma.get;

        const handler = get.cache_size;

        return this.#process(
            handler, [], reviewer
        );
    }

    /**
     * 获取数据库的日志模式
     * 
     * @typedef {PragmaModel["set"]["journal_mode"]} PSJMHanlder
     * 
     * @param {Parameters<PSJMHanlder>[0]} mode 日志模式
     * @param {Function} reviewer 语句生成结果审查函数
     * @returns 执行结果
     */
    set_journal_mode_config(mode, reviewer) {
        const { pragma } = this.generator;

        const set = pragma.set;

        const handler = set.journal_mode;

        const args = [ mode ];

        return this.#process(
            handler, args, reviewer
        );
    }

    /**
     * 获取数据库与文件系统的数据同步强度
     * 
     * @typedef {PragmaModel["set"]["synchronous"]} PSSHanlder
     * 
     * @param {Parameters<PSSHanlder>[0]} mode 同步强度
     * @param {Function} reviewer 语句生成结果审查函数
     * @returns 执行结果
     */
    set_synchronous_config(mode, reviewer) {
        const { pragma } = this.generator;

        const set = pragma.set;

        const handler = set.synchronous;

        const args = [ mode ];

        return this.#process(
            handler, args, reviewer
        );
    }

    /**
     * 获取外键约束启用状态
     * 
     * @typedef {PragmaModel["set"]["foreign_keys"]} PSKSHanlder
     * 
     * @param {Parameters<PSKSHanlder>[0]} value 启用状态
     * @param {Function} reviewer 语句生成结果审查函数
     * @returns 执行结果
     */
    set_foreign_keys_config(value, reviewer) {
        const { pragma } = this.generator;

        const set = pragma.set;

        const handler = set.foreign_keys;

        const args = [ value ];

        return this.#process(
            handler, args, reviewer
        );
    }

    /**
     * 获取临时表存储配置
     * 
     * @typedef {PragmaModel["set"]["temp_store"]} PSTSHanlder
     * 
     * @param {Parameters<PSTSHanlder>[0]} value 存储配置
     * @param {Function} reviewer 语句生成结果审查函数
     * @returns 执行结果
     */
    set_temp_store_config(value, reviewer) {
        const { pragma } = this.generator;

        const set = pragma.set;

        const handler = set.temp_store;

        const args = [ value ];

        return this.#process(
            handler, args, reviewer
        );
    }

    /**
     * 获取数据库的忙碌重试超时时长（单位：毫秒）
     * 
     * @typedef {PragmaModel["set"]["busy_timeout"]} PSBTHanlder
     * 
     * @param {Parameters<PSBTHanlder>[0]} duration 超时时长
     * @param {Function} reviewer 语句生成结果审查函数
     * @returns 执行结果
     */
    set_busy_timeout_config(duration, reviewer) {
        const { pragma } = this.generator;

        const set = pragma.set;

        const handler = set.busy_timeout;

        const args = [ duration ];

        return this.#process(
            handler, args, reviewer
        );
    }

    /**
     * 获取数据库的缓存大小（单位：页）
     * 
     * @typedef {PragmaModel["set"]["cache_size"]} PSCSHanlder
     * 
     * @param {Parameters<PSCSHanlder>[0]} cache_size 缓存大小
     * @param {Function} reviewer 语句生成结果审查函数
     * @returns 执行结果
     */
    set_cache_size_config(cache_size, reviewer) {
        const { pragma } = this.generator;

        const set = pragma.set;

        const handler = set.cache_size;

        const args = [ cache_size ];

        return this.#process(
            handler, args, reviewer
        );
    }

    /**
     * 以 request 的形式执行 SQL 语句
     * 
     * @param {string} sentence 需要执行的 SQL 语句
     * @param {Object<string, any>} parameter 占位参数列表
     * @returns 执行结果
     */
    request_sentence(sentence, parameter = {}) {
        const handler = () => ({
            "action": "request",
            sentence, parameter
        });

        return this.#process(handler);
    }

    /**
     * 以 execute 的形式执行 SQL 语句
     * 
     * @param {string} sentence 需要执行的 SQL 语句
     * @param {Object<string, any>} parameter 占位参数列表
     * @returns 执行结果
     */
    execute_sentence(sentence, parameter = {}) {
        const _handler = () => ({
            "action": "execute",
            sentence, parameter
        });

        return this.#process(_handler);
    }

    /**
     * 以 single 的形式执行 SQL 语句
     * 
     * @param {string} sentence 需要执行的 SQL 语句
     * @param {Object<string, any>} parameter 占位参数列表
     * @returns 执行结果
     */
    request_single_sentence(sentence, parameter = {}) {
        const _handler = () => ({
            "action": "single",
            sentence, parameter
        });

        return this.#process(_handler);
    }

    /**
     * 以 iterate 的形式执行 SQL 语句
     * 
     * @param {string} sentence 需要执行的 SQL 语句
     * @param {Object<string, any>} parameter 占位参数列表
     * @returns 执行结果
     */
    execute_iterate_sentence(sentence, parameter = {}) {
        const _handler = () => ({
            "action": "iterate",
            sentence, parameter
        });

        return this.#process(_handler);
    }

    /**
     * 通过固定的配置构建 CASE 语句
     * 
     * @typedef {SentenceModel["case"]} SCSHanlder
     * 
     * @param {Parameters<SCSHanlder>[0]} values 构建 CASE 语句的配置集合
     * @param {Parameters<SCSHanlder>[1]} options 构建语句时使用的配置
     * @returns {string} 语句构建结果
     */
    build_case_statement(values, options) {
        const { statement } = this.generator;

        const handler = statement.case;

        return handler(values, options);
    }

    /**
     * 通过固定的配置构建 CASE 语句
     * 
     * @typedef {SentenceModel["abstract"]["case"]["single"]} SACSSHanlder
     * 
     * @param {Parameters<SACSSHanlder>[0]} column 需要构建 CASE 语句的列
     * @param {Parameters<SACSSHanlder>[1]} mapping 数值映射关系
     * @param {Parameters<SACSSHanlder>[2]} options 构建语句时使用的配置
     * @returns {string} 语句构建结果
     */
    build_single_case_statement(column, mapping, options) {
        const { statement } = this.generator;

        const { abstract } = statement;

        const handler = abstract.case.single;

        return handler(column, mapping, options);
    }

    /**
     * 将绑定在参数对象中的参数以安全的形式嵌入到 SQL 语句当中
     * * 仅支持本代码库所自动生成的形式的嵌入
     * 
     * @param {string} sentence 需要处理的 SQL 语句 
     * @param {Record<string, any>} params 包含绑定的参数的对象
     * @returns {string} 将参数内嵌在 SQL 语句中的形式
     */
    tool_builtin_sentence_params(sentence, params) {
        const { tool: handlers } = this.generator;

        const handler = handlers.sentence.builtin;

        return handler(sentence, params);
    }

    /**
     * 获取一个操作控制器
     * 
     * @param {string} suffix 控制器后缀
     * @param {string[]} operates 控制器操作
     * @param {object} target 读取目标
     * @returns 操作控制器
     */
    #get_handlers(suffix, operates, target) {
        const result = {};

        target ??= this, suffix ??= "";

        if (suffix.length > 0) {
            suffix = "_" + suffix;
        }

        for (const operate of operates) {
            result[operate] = target[
                operate + suffix
            ].bind(this);
        }

        return result;
    }

    /**
     * 获取一个视图控制器
     * 
     * @typedef {Object} ViewColler
     * @property {DbOpor["remove_view"]} remove 删除一个视图
     * 
     * @returns {ViewColler} 视图控制器
     */
    view() {
        const operates = [
            "remove", "create"
        ];

        return this.#get_handlers(
            "view", operates
        );
    }

    /**
     * 获取一个表单控制器
     * 
     * @typedef {Object} TableColler
     * @property {DbOpor["alter_table"]} alter 修改一个表格
     * @property {DbOpor["create_table"]} create 创建一个表格
     * @property {DbOpor["remove_table"]} remove 删除一个表格
     * 
     * @returns {TableColler} 表单控制器
     */
    table() {
        const operates = [
            "create", "remove", "alter"
        ];

        return this.#get_handlers(
            "table", operates
        );
    }

    /**
     * 获取一个索引控制器
     * 
     * @typedef {Object} IndexColler
     * @property {DbOpor["create_index"]} create 创建一个索引
     * @property {DbOpor["remove_index"]} remove 删除一个索引
     * 
     * @returns {IndexColler} 索引控制器
     */
    index() {
        const operates = [
            "create", "remove"
        ];

        return this.#get_handlers(
            "index", operates
        );
    }

    /**
     * 获取一个记录控制器
     * 
     * @typedef {Object} RecordColler
     * @property {DbOpor["count_record"]} count 计数记录
     * @property {DbOpor["update_record"]} update 更新记录
     * @property {DbOpor["insert_record"]} insert 插入记录
     * @property {DbOpor["delete_record"]} delete 删除记录
     * @property {DbOpor["select_record"]} select 查询记录
     * @property {Object} union 合并查询
     * @property {DbOpor["select_record_union"]} union.select 合并查询
     * 
     * @returns {RecordColler} 记录控制器
     */
    record() {
        const operates = [
            "insert", "update", "delete",
            "select", "count"
        ];

        const handlers =
            this.#get_handlers(
                "record", operates
            );

        const append = { "union": { "select":
            this.select_record_union.bind(this)
        }};

        return Object.assign(
            {}, handlers, append
        );
    }

    /**
     * 获取一个触发器控制器
     * 
     * @typedef {Object} TriggerColler
     * @property {DbOpor["remove_trigger"]} remove 移除一个触发器
     * 
     * @returns {TriggerColler} 触发器控制器
     */
    trigger() {
        const operates = [ "remove" ];

        return this.#get_handlers(
            "trigger", operates
        );
    }

    /**
     * 获取一个保存点控制器
     * 
     * @typedef {Object} PointColler
     * @property {DbOpor["create_point"]} create 创建一个保存点
     * @property {DbOpor["release_point"]} release 释放一个保存点
     * @property {DbOpor["rollback_point"]} rollback 回滚到一个保存点
     * 
     * @returns {PointColler} 保存点控制器
     */
    savepoint() {
        const operates = [
            "create", "release", "rollback"
        ];

        return this.#get_handlers(
            "point", operates
        );
    }

    /**
     * 获取事务控制器
     * 
     * @typedef {Object} TranColler
     * @property {DbOpor["begin_transaction"]} begin 开始一个事务
     * @property {DbOpor["commit_transaction"]} commit 提交一个事务
     * @property {DbOpor["rollback_transaction"]} rollback 回滚一个事务
     * 
     * @returns {TranColler} 事务控制器
     */
    transaction() {
        const operates = [
            "begin", "commit", "rollback"
        ];

        return this.#get_handlers(
            "transaction", operates
        );
    }

    /**
     * 获取数据库控制器
     * 
     * @typedef {Object} DbColler
     * @property {DbOpor["backup_database"]} backup 备份数据库
     * @property {DbOpor["optimize_database"]} optimize 优化数据库
     * @property {DbOpor["vacuum_database"]} vacuum 清理数据库
     * @property {DbOpor["close_database"]} close 关闭数据库
     * 
     * @returns {DbColler} 数据库控制器
     */
    database() {
        const operates = [
            "backup", "optimize", "vacuum", "close"
        ];

        return this.#get_handlers(
            "database", operates
        );
    }

    /**
     * 为对象中的函数绑定 this 对象
     * 
     * @private
     * @template T
     * 
     * @param {T} obj 需要绑定 this 对象的对象
     * @param {object} target 需要绑定的 this 对象
     * @returns {T} 绑定了 this 对象的对象
     */
    #bind(obj, target) {
        const result = {};

        const entries = Object.entries(obj);

        for (let index = 0; index < entries.length; index++) {
            const [ key, value ] = entries[index];

            if (typeof value === "function") {
                result[key] = value.bind(target);
            } else {
                result[key] = this.#bind(
                    value, target
                );
            }
        }

        return result;
    }

    /**
     * 获取一个 pragma 指令控制器
     * 
     * @returns pragma 指令控制器
     */
    pragma() {
        return this.#bind({
            "foreign_keys": {
                "read": () => {
                    return this.get_foreign_keys_config();
                },

                "enable": () => {
                    return this.set_foreign_keys_config("on");
                },
                "disable": () => {
                    return this.set_foreign_keys_config("off");
                },

                "restore": () => {
                    return this.set_foreign_keys_config("default");
                }
            },

            "temp_store": {
                "read": () => {
                    return this.get_temp_store_config();
                },

                "file": () => {
                    return this.set_temp_store_config("file");
                },
                "memory": () => {
                    return this.set_temp_store_config("memory");
                },
                
                "restore": () => {
                    return this.set_temp_store_config("default");
                }
            },

            "busy_timeout": {
                "set": (duration) => {
                    return this.set_busy_timeout_config(duration);
                },

                "read": () => {
                    return this.get_busy_timeout_config();
                },

                "restore": () => {
                    return this.set_busy_timeout_config("default");
                }
            },

            "cache_size": {
                "set": (cache_size) => {
                    return this.set_cache_size_config(cache_size);
                },

                "read": () => {
                    return this.get_cache_size_config();
                },

                "restore": () => {
                    return this.set_cache_size_config("default");
                }
            },

            "journal_mode": {
                "read": () => {
                    return this.get_journal_mode_config();
                },

                /**
                 * 启用指定的日志模式
                 * 
                 * @typedef {("wal"|"delete"|"truncate"|"persist")} AllowMode
                 * 
                 * @param {AllowMode} mode 需要启用的日志模式
                 * @returns 执行结果
                 */
                "enable": (mode) => {
                    mode = mode.toLowerCase();

                    return this.set_journal_mode_config(mode);
                },

                "wal": () => {
                    return this.set_journal_mode_config("wal");
                },
                "delete": () => {
                    return this.set_journal_mode_config("delete");
                },
                "truncate": () => {
                    return this.set_journal_mode_config("truncate");
                },
                "persist": () => {
                    return this.set_journal_mode_config("persist");
                },

                "restore": () => {
                    return this.set_journal_mode_config("default");
                }
            },

            "synchronous": {
                "read": () => {
                    return this.get_synchronous_config();
                },

                "close": () => {
                    return this.set_synchronous_config("off");
                },
                "full": () => {
                    return this.set_synchronous_config("full");
                },
                "normal": () => {
                    return this.set_synchronous_config("normal");
                },

                "restore": () => {
                    return this.set_synchronous_config("default");
                }
            }
        }, this);
    }

    /**
     * 获取语句执行器
     * 
     * @returns 语句执行器
     */
    sentence() {
        return this.#bind({
            "execute": {
                "default": this.execute_sentence,
                "iterate": this.execute_iterate_sentence
            },

            "request": {
                "default": this.request_sentence,
                "single": this.request_single_sentence
            }
        }, this);
    }

    /**
     * 获取 SQL 指令处理器
     * 
     * @returns 可以处理 SQL 指令处理器
     */
    statement() {
        return this.#bind({
            "build": {
                "case": {
                    "complex": this.build_case_statement,
                    "abstract": {
                        "single": this.build_single_case_statement
                    }
                }
            }
        }, this);
    }
}