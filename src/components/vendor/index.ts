import AwsExamtopics from './_/aws-examtopics.js'
import AwsITExams from './_/aws-itexams.js'
import AwsMytodo from './_/aws-mytodo.js'
import BiguoChapter from './_/biguo-chapter.js'
import BiguoFree from './_/biguo-free.js'
import BiguoReal from './_/biguo-real.js'
import BiguoVip from './_/biguo-vip.js'
import ChaoXingAssets from './_/chaoxing-assets.js'
import ChaoXingExam from './_/chaoxing-exam.js'
import ChaoXingWork from './_/chaoxing-work.js'
import Demo from './_/demo.js'
import FenbiJiaoyu from './_/fenbi-jiaoyu.js'
import FenbiKaoyan from './_/fenbi-kaoyan.js'
import FenbiYy46j from './_/fenbi-yy46j.js'
import _ from './_/index.js'
import JsonFile from './_/json-file.js'
import LearnABC from './_/learnabc.js'
import Markji from './_/markji.js'
import Rdyc from './_/rdyc.js'
import Shangfen from './_/shangfen.js'
import SitecoreITExams from './_/sitecore-itexams.js'
import SitecoreStreza from './_/sitecore-streza.js'
import WantikuChapter from './_/wantiku-chapter.js'
import Wantiku from './_/wantiku.js'
import Wx233 from './_/wx233.js'
import Yiguo from './_/yiguo.js'

export default class VendorManager {
  protected static components = {
    [AwsExamtopics.META.key]: AwsExamtopics /** todo */,
    [AwsITExams.META.key]: AwsITExams /** todo */,
    [AwsMytodo.META.key]: AwsMytodo,
    [BiguoChapter.META.key]: BiguoChapter,
    [BiguoFree.META.key]: BiguoFree,
    [BiguoReal.META.key]: BiguoReal,
    [BiguoVip.META.key]: BiguoVip,
    [ChaoXingAssets.META.key]: ChaoXingAssets,
    [ChaoXingExam.META.key]: ChaoXingExam /** todo */,
    [ChaoXingWork.META.key]: ChaoXingWork /** todo */,
    [Demo.META.key]: Demo,
    [FenbiJiaoyu.META.key]: FenbiJiaoyu /** wip */,
    [FenbiKaoyan.META.key]: FenbiKaoyan,
    [FenbiYy46j.META.key]: FenbiYy46j /** wip */,
    [JsonFile.META.key]: JsonFile,
    [LearnABC.META.key]: LearnABC,
    [Markji.META.key]: Markji,
    [Rdyc.META.key]: Rdyc /** todo */,
    [Shangfen.META.key]: Shangfen,
    [SitecoreITExams.META.key]: SitecoreITExams /** todo */,
    [SitecoreStreza.META.key]: SitecoreStreza,
    [Wantiku.META.key]: Wantiku,
    [WantikuChapter.META.key]: WantikuChapter,
    [Wx233.META.key]: Wx233,
    [Yiguo.META.key]: Yiguo,
  }

  public static getClass(name: string) {
    return this.components[name]
  }

  public static getMetas() {
    return Object.values(this.components).map((component) => component.META)
  }

  public static getNames() {
    return _.list()
  }
}
