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
import FenbiKaoyan from './_/fenbi-kaoyan.js'
import Fenbi from './_/fenbi.js'
import _ from './_/index.js'
import JsonFile from './_/json-file.js'
import LearnABC from './_/learnabc.js'
import Markji from './_/markji.js'
import Shangfen from './_/shangfen.js'
import SitecoreITExams from './_/sitecore-itexams.js'
import SitecoreStreza from './_/sitecore-streza.js'
import WantikuChapter from './_/wantiku-chapter.js'
import Wantiku from './_/wantiku.js'
import Wx233 from './_/wx233.js'
import Yiguo from './_/yiguo.js'

export default class VendorManager {
  protected static components = {
    /** todo */ [AwsExamtopics.META.key]: AwsExamtopics,
    /** todo */ [AwsITExams.META.key]: AwsITExams,
    /** done */ [AwsMytodo.META.key]: AwsMytodo,
    /** done */ [BiguoChapter.META.key]: BiguoChapter,
    /** done */ [BiguoFree.META.key]: BiguoFree,
    /** done */ [BiguoReal.META.key]: BiguoReal,
    /** done */ [BiguoVip.META.key]: BiguoVip,
    /** done */ [ChaoXingAssets.META.key]: ChaoXingAssets,
    /** todo */ [ChaoXingExam.META.key]: ChaoXingExam,
    /** todo */ [ChaoXingWork.META.key]: ChaoXingWork,
    /** done */ [Demo.META.key]: Demo,
    /** wip */ [Fenbi.META.key]: Fenbi,
    /** done */ [FenbiKaoyan.META.key]: FenbiKaoyan,
    /** done */ [JsonFile.META.key]: JsonFile,
    /** done */ [LearnABC.META.key]: LearnABC,
    /** done */ [Markji.META.key]: Markji,
    /** done */ [Shangfen.META.key]: Shangfen,
    /** todo */ [SitecoreITExams.META.key]: SitecoreITExams,
    /** done */ [SitecoreStreza.META.key]: SitecoreStreza,
    /** done */ [Wantiku.META.key]: Wantiku,
    /** done */ [WantikuChapter.META.key]: WantikuChapter,
    /** done */ [Wx233.META.key]: Wx233,
    /** done */ [Yiguo.META.key]: Yiguo,
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
