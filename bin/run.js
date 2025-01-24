#!/usr/bin/env -S node --expose-gc

import {execute} from '@oclif/core'

await execute({dir: import.meta.url})
