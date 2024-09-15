#!/usr/bin/env node --expose-gc

import {execute} from '@oclif/core'

await execute({dir: import.meta.url})
