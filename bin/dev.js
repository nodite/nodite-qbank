#!/usr/bin/env -S node --expose-gc

import {register} from 'node:module'
import {pathToFileURL} from 'node:url'

import {execute} from '@oclif/core'

register('ts-node/esm', pathToFileURL('./'))

await execute({development: true, dir: import.meta.url})
