import {Hook} from '@oclif/core'

const prerun = async () => {}

const hook: Hook.Prerun = prerun

export {prerun as postrun}
export default hook
