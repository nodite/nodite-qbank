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
* [`qbank vendor login`](#qbank-vendor-login)

## `qbank bank list`

List banks

```
USAGE
  $ qbank bank list [-r] [-u <value>] [-v <value>]

FLAGS
  -r, --clean             清除缓存
  -u, --username=<value>  用户名/邮箱/手机号
  -v, --vendor=<value>    题库供应商

DESCRIPTION
  List banks

EXAMPLES
  $ qbank bank list
  List banks (./src/commands/course/list.ts)
```

_See code: [src/commands/bank/list.ts](https://github.com/oscaner/qbank/blob/v0.0.0/src/commands/bank/list.ts)_

## `qbank category list`

List categories

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
  List categories

EXAMPLES
  $ qbank category list
  List categories (./src/commands/category/list.ts)
```

_See code: [src/commands/category/list.ts](https://github.com/oscaner/qbank/blob/v0.0.0/src/commands/category/list.ts)_

## `qbank chain`

Chain to qbank

```
USAGE
  $ qbank chain [-r *|bank.list|category.list|sheet.list|question.fetch|output.convert|output.upload...]
    [-u <value>] [-v <value>] [--bank_list <value>...] [--category_list <value>...] [--delay <value>] [--output <value>]
    [--output_username <value>] [--sheet_list <value>...]

FLAGS
  -r, --clean=<option>...         [default: ] 清除缓存/重新转换
                                  <options:
                                  *|bank.list|category.list|sheet.list|question.fetch|output.convert|output.upload>
  -u, --username=<value>          用户名/邮箱/手机号
  -v, --vendor=<value>            题库供应商
      --bank_list=<value>...      [default: *] 题库
      --category_list=<value>...  [default: *] 分类
      --delay=<value>             延迟(ms)
      --output=<value>            接收方
      --output_username=<value>   接收方用户名
      --sheet_list=<value>...     [default: *] 试卷

DESCRIPTION
  Chain to qbank

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

_See code: [@oclif/plugin-help](https://github.com/oclif/plugin-help/blob/v6.2.10/src/commands/help.ts)_

## `qbank output convert`

Convert questions

```
USAGE
  $ qbank output convert [-r] [-u <value>] [-v <value>] [-b <value>] [-c <value>] [-o <value>] [--output_username
    <value>] [-s <value>]

FLAGS
  -b, --bank=<value>             题库ID/名称/Key
  -c, --category=<value>         分类ID/名称
  -o, --output=<value>           接收方
  -r, --clean                    清除缓存
  -s, --sheet=<value>            试卷ID/名称
  -u, --username=<value>         用户名/邮箱/手机号
  -v, --vendor=<value>           题库供应商
      --output_username=<value>  接收方用户名

DESCRIPTION
  Convert questions

EXAMPLES
  $ qbank output convert
  Convert questions (./src/commands/output/convert.ts)
```

_See code: [src/commands/output/convert.ts](https://github.com/oscaner/qbank/blob/v0.0.0/src/commands/output/convert.ts)_

## `qbank output upload`

Upload questions

```
USAGE
  $ qbank output upload [-r] [-u <value>] [-v <value>] [-b <value>] [-c <value>] [-o <value>] [--output_username
    <value>] [-s <value>]

FLAGS
  -b, --bank=<value>             题库ID/名称/Key
  -c, --category=<value>         分类ID/名称
  -o, --output=<value>           接收方
  -r, --clean                    清除缓存
  -s, --sheet=<value>            试卷ID/名称
  -u, --username=<value>         用户名/邮箱/手机号
  -v, --vendor=<value>           题库供应商
      --output_username=<value>  接收方用户名

DESCRIPTION
  Upload questions

EXAMPLES
  $ qbank output upload
  Upload questions (./src/commands/output/upload.ts)
```

_See code: [src/commands/output/upload.ts](https://github.com/oscaner/qbank/blob/v0.0.0/src/commands/output/upload.ts)_

## `qbank question fetch`

Fetch questions

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
  Fetch questions

EXAMPLES
  $ qbank question fetch
  Fetch questions (./src/commands/question/fetch.ts)
```

_See code: [src/commands/question/fetch.ts](https://github.com/oscaner/qbank/blob/v0.0.0/src/commands/question/fetch.ts)_

## `qbank sheet list`

List sheets

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
  List sheets

EXAMPLES
  $ qbank sheet list
  List sheets (./src/commands/sheet/list.ts)
```

_See code: [src/commands/sheet/list.ts](https://github.com/oscaner/qbank/blob/v0.0.0/src/commands/sheet/list.ts)_

## `qbank vendor login`

Login to vendor

```
USAGE
  $ qbank vendor login [-r] [-u <value>] [-v <value>] [-p <value>]

FLAGS
  -p, --password=<value>  密码
  -r, --clean             清除缓存
  -u, --username=<value>  用户名/邮箱/手机号
  -v, --vendor=<value>    题库供应商

DESCRIPTION
  Login to vendor

EXAMPLES
  $ qbank vendor login
  Login to vendor (./src/commands/vendor/login.ts)
```

_See code: [src/commands/vendor/login.ts](https://github.com/oscaner/qbank/blob/v0.0.0/src/commands/vendor/login.ts)_
<!-- commandsstop -->
