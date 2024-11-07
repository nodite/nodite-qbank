qbank
=================

A new CLI generated with oclif


[![oclif](https://img.shields.io/badge/cli-oclif-brightgreen.svg)](https://oclif.io)
[![Version](https://img.shields.io/npm/v/qbank.svg)](https://npmjs.org/package/qbank)
[![Downloads/week](https://img.shields.io/npm/dw/qbank.svg)](https://npmjs.org/package/qbank)


<!-- toc -->
* [Usage](#usage)
* [Commands](#commands)
<!-- tocstop -->
# Usage
<!-- usage -->
```sh-session
$ npm install -g qbank
$ qbank COMMAND
running command...
$ qbank (--version)
qbank/0.0.0 darwin-arm64 node-v20.15.0
$ qbank --help [COMMAND]
USAGE
  $ qbank COMMAND
...
```
<!-- usagestop -->
# Commands
<!-- commands -->
* [`qbank bank list`](#qbank-bank-list)
* [`qbank category list`](#qbank-category-list)
* [`qbank chain`](#qbank-chain)
* [`qbank help [COMMAND]`](#qbank-help-command)
* [`qbank output convert`](#qbank-output-convert)
* [`qbank output upload`](#qbank-output-upload)
* [`qbank question fetch`](#qbank-question-fetch)
* [`qbank sheet list`](#qbank-sheet-list)
* [`qbank vendor list`](#qbank-vendor-list)
* [`qbank vendor login`](#qbank-vendor-login)

## `qbank bank list`

题库列表

```
USAGE
  $ qbank bank list [-r] [-u <value>] [-v <value>]

FLAGS
  -r, --clean             清除缓存
  -u, --username=<value>  用户名/邮箱/手机号
  -v, --vendor=<value>    题库供应商

DESCRIPTION
  题库列表

EXAMPLES
  $ qbank bank list
  List banks (./src/commands/course/list.ts)
```

_See code: [src/commands/bank/list.ts](https://github.com/oscaner/qbank/blob/v0.0.0/src/commands/bank/list.ts)_

## `qbank category list`

类别列表

```
USAGE
  $ qbank category list [-r] [-u <value>] [-v <value>] [-b <value>] [--rich]

FLAGS
  -b, --bank=<value>      题库ID/名称/Key
  -r, --clean             清除缓存
  -u, --username=<value>  用户名/邮箱/手机号
  -v, --vendor=<value>    题库供应商
      --rich              详细信息

DESCRIPTION
  类别列表

EXAMPLES
  $ qbank category list
  List categories (./src/commands/category/list.ts)
```

_See code: [src/commands/category/list.ts](https://github.com/oscaner/qbank/blob/v0.0.0/src/commands/category/list.ts)_

## `qbank chain`

链式调用 qbank 命令

```
USAGE
  $ qbank chain [-r *|bank.list|category.list|sheet.list|question.fetch|output.convert|output.upload...]
    [-u <value>] [-v <value>] [--bank-list <value>...] [--category-list <value>...] [--delay <value>] [--output <value>]
    [--output-username <value>] [--sheet-list <value>...]

FLAGS
  -r, --clean=<option>...         [default: ] 清除缓存/重新转换
                                  <options:
                                  *|bank.list|category.list|sheet.list|question.fetch|output.convert|output.upload>
  -u, --username=<value>          用户名/邮箱/手机号
  -v, --vendor=<value>            题库供应商
      --bank-list=<value>...      [default: *] 题库
      --category-list=<value>...  [default: *] 分类
      --delay=<value>             延迟(ms)
      --output=<value>            接收方
      --output-username=<value>   接收方用户名
      --sheet-list=<value>...     [default: *] 试卷

DESCRIPTION
  链式调用 qbank 命令

EXAMPLES
  $ qbank chain
  Chain to qbank (./src/commands/chain/index.ts)
```

_See code: [src/commands/chain/index.ts](https://github.com/oscaner/qbank/blob/v0.0.0/src/commands/chain/index.ts)_

## `qbank help [COMMAND]`

Display help for qbank.

```
USAGE
  $ qbank help [COMMAND...] [-n]

ARGUMENTS
  COMMAND...  Command to show help for.

FLAGS
  -n, --nested-commands  Include all nested commands in the output.

DESCRIPTION
  Display help for qbank.
```

_See code: [@oclif/plugin-help](https://github.com/oclif/plugin-help/blob/v6.2.16/src/commands/help.ts)_

## `qbank output convert`

转换题目格式

```
USAGE
  $ qbank output convert [-r] [-u <value>] [-v <value>] [-b <value>] [-c <value>] [-o <value>] [--output-username
    <value>] [-s <value>]

FLAGS
  -b, --bank=<value>             题库ID/名称/Key
  -c, --category=<value>         分类ID/名称
  -o, --output=<value>           接收方
  -r, --clean                    清除缓存
  -s, --sheet=<value>            试卷ID/名称
  -u, --username=<value>         用户名/邮箱/手机号
  -v, --vendor=<value>           题库供应商
      --output-username=<value>  接收方用户名

DESCRIPTION
  转换题目格式

EXAMPLES
  $ qbank output convert
  Convert questions (./src/commands/output/convert.ts)
```

_See code: [src/commands/output/convert.ts](https://github.com/oscaner/qbank/blob/v0.0.0/src/commands/output/convert.ts)_

## `qbank output upload`

上传题目到接收方

```
USAGE
  $ qbank output upload [-r] [-u <value>] [-v <value>] [-b <value>] [-c <value>] [-o <value>] [--output-username
    <value>] [-s <value>]

FLAGS
  -b, --bank=<value>             题库ID/名称/Key
  -c, --category=<value>         分类ID/名称
  -o, --output=<value>           接收方
  -r, --clean                    清除缓存
  -s, --sheet=<value>            试卷ID/名称
  -u, --username=<value>         用户名/邮箱/手机号
  -v, --vendor=<value>           题库供应商
      --output-username=<value>  接收方用户名

DESCRIPTION
  上传题目到接收方

EXAMPLES
  $ qbank output upload
  Upload questions (./src/commands/output/upload.ts)
```

_See code: [src/commands/output/upload.ts](https://github.com/oscaner/qbank/blob/v0.0.0/src/commands/output/upload.ts)_

## `qbank question fetch`

爬取题目

```
USAGE
  $ qbank question fetch [-r] [-u <value>] [-v <value>] [-b <value>] [-c <value>] [-s <value>]

FLAGS
  -b, --bank=<value>      题库ID/名称/Key
  -c, --category=<value>  分类ID/名称
  -r, --clean             清除缓存
  -s, --sheet=<value>     试卷ID/名称
  -u, --username=<value>  用户名/邮箱/手机号
  -v, --vendor=<value>    题库供应商

DESCRIPTION
  爬取题目

EXAMPLES
  $ qbank question fetch
  Fetch questions (./src/commands/question/fetch.ts)
```

_See code: [src/commands/question/fetch.ts](https://github.com/oscaner/qbank/blob/v0.0.0/src/commands/question/fetch.ts)_

## `qbank sheet list`

章节/篇章/试卷列表

```
USAGE
  $ qbank sheet list [-r] [-u <value>] [-v <value>] [-b <value>] [-c <value>]

FLAGS
  -b, --bank=<value>      题库ID/名称/Key
  -c, --category=<value>  分类ID/名称/Key
  -r, --clean             清除缓存
  -u, --username=<value>  用户名/邮箱/手机号
  -v, --vendor=<value>    题库供应商

DESCRIPTION
  章节/篇章/试卷列表

EXAMPLES
  $ qbank sheet list
  List sheets (./src/commands/sheet/list.ts)
```

_See code: [src/commands/sheet/list.ts](https://github.com/oscaner/qbank/blob/v0.0.0/src/commands/sheet/list.ts)_

## `qbank vendor list`

题库供应商列表

```
USAGE
  $ qbank vendor list

DESCRIPTION
  题库供应商列表

EXAMPLES
  $ qbank vendor list
  List vendors (./src/commands/vendor/list.ts)
```

_See code: [src/commands/vendor/list.ts](https://github.com/oscaner/qbank/blob/v0.0.0/src/commands/vendor/list.ts)_

## `qbank vendor login`

登录供应商

```
USAGE
  $ qbank vendor login [-r] [-u <value>] [-v <value>] [-p <value>]

FLAGS
  -p, --password=<value>  密码
  -r, --clean             清除缓存
  -u, --username=<value>  用户名/邮箱/手机号
  -v, --vendor=<value>    题库供应商

DESCRIPTION
  登录供应商

EXAMPLES
  $ qbank vendor login
  Login to vendor (./src/commands/vendor/login.ts)
```

_See code: [src/commands/vendor/login.ts](https://github.com/oscaner/qbank/blob/v0.0.0/src/commands/vendor/login.ts)_
<!-- commandsstop -->
