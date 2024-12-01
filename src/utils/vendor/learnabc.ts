/* eslint-disable max-len */

import CryptoJS from 'crypto-js'

// __d(function(g,r,i,a,m,e,d){var t=r(d[0]),n=t(r(d[1])),u=t(r(d[2])),o=(r(d[3]),r(d[4])),c=r(d[5]),p=r(d[6]),s=r(d[7]),l=r(d[8]).Base64,f={cjk:['u4e00','u9fa5'],num:['u0030','u0039'],lal:['u0061','u007a'],ual:['u0041','u005a'],asc:['u0020','u007e']},y=(function(){function t(){(0,n.default)(this,t)}return(0,u.default)(t,[{key:"unshiftString",value:function(t,n){var u,o,p,s,y,v,k='cjk';switch(n){case c.paperType.WIKI:u=[204,185,425,212,65,213,650,38,356,1709,364];break;case c.paperType.IQ:case c.paperType.BRAIN_TWISTER:break;default:u=[204,185,425,212,65,213,650,38,356,1709,364]}switch(typeof k){case'undefined':k='cjk';case'string':o=k==p?null:f[k];break;default:o=k}o&&(s=parseInt(o[0].substring(1),16),y=parseInt(o[1].substring(1),16)-s+1,v=RegExp('[\\'+o[0]+'-\\'+o[1]+']','g'),p=k);var h=u.length,S=0;return l.decode(t).replace(v,function(t){var n=t.charCodeAt(0)-s;return String.fromCharCode((n-u[S++%h]%y+y)%y+s)})}},{key:"urlWithParameters",value:function(t,n){var u=t,o='';for(var c in t.indexOf('?')<=-1&&(u+="?"),n)o=o+"&"+c+"="+n[c];return u+o.substr(1)}},{key:"sqliteStr",value:function(t){return t.replace(/\'/g,'"')}},{key:"getPaperStorageId",value:function(t){return'paperNowCategory'+t+'id'}},{key:"decryptQuestion",value:function(t){return t=t.replace(/[\r\n]/g,''),s.AES.decrypt(t,'MZKDO96JQ01PRNXK19I').toString(s.enc.Utf8)}},{key:"decryptAnalyzing",value:function(t){return t=t.replace(/[\r\n]/g,''),s.AES.decrypt(t,'LDIEJXMSK5'+p.decodeString).toString(s.enc.Utf8)}},{key:"decryptServer",value:function(t){return(t=t&&t.replace(/[\r\n]/g,''))&&s.AES.decrypt(t,s.enc.Utf8.parse('K95ERY6P'+p.decodeString2),{iv:s.enc.Utf8.parse('1234567898765432'),padding:s.pad.ZeroPadding,mode:s.mode.CBC}).toString(s.enc.Utf8)}},{key:"formatPaper",value:function(t){return 2==t.decode_type?(t.question=this.decryptServer(t.shift_question),t.analyzing=this.decryptServer(t.shift_analyzing)):(t.question=this.decryptQuestion(t.shift_question),t.analyzing=this.decryptAnalyzing(t.shift_analyzing)),console.log(t,'formatPaper'),t.options=Array.isArray(t.options)?t.options:t.options?JSON.parse(t.options):[],t}},{key:"GetRandomNum",value:function(t,n){var u=n-t,o=Math.random();return t+Math.round(o*u)}},{key:"dealString",value:function(t){return t.replace(/[\r\n]/g,"")}},{key:"delHtmlTag",value:function(t){return t.replace(/<[^>]+>/g,"")}},{key:"trimStr",value:function(t){return t.replace(/^\s+/,"")}},{key:"showToast",value:function(t){o.Toast.show({text:t,buttonText:"OK",duration:3e3,position:"top"})}},{key:"getTableName",value:function(t){var n;switch(t){case'cq':n='cqpaper';break;case c.paperType.IQ:n='iqpaper';break;case c.paperType.BRAIN_TWISTER:n='brainpaper'}return n}}]),t})();m.exports=new y},851,[1,22,23,847,480,852,853,854,888]);
// __d(function(g,r,i,a,m,e,d){Object.defineProperty(e,"__esModule",{value:!0}),e.default=e.PaperCategory=e.paperType=void 0;var p={WIKI:'wiki',IQ:'iq',BRAIN_TWISTER:'brain'};e.paperType=p;e.PaperCategory=[{key:1,value:'\u8bed\u6cd5\u9898'},{key:2,value:'\u8bcd\u6c47\u9898'}];var t=p;e.default=t},852,[]);
// __d(function(g,r,i,a,m,e,d){Object.defineProperty(e,"__esModule",{value:!0}),e.AD_TYPES_2_LIST=e.AD_TYPES_2=e.AD_TYPES=e.privacy_policy_url=e.user_agreement_url=e.decodeString2=e.decodeString=e.IAP_IDS=void 0;e.IAP_IDS={NO_AD:'English_No_Ad'};e.decodeString="8U85JLZPQ";e.decodeString2="TUFJ1I49";e.user_agreement_url='http://oss.beauty-story.cn/app/abcpaper/html/user_agreement2.html';e.privacy_policy_url='http://oss.beauty-story.cn/app/abcpaper/html/privacy_policy2.html';e.AD_TYPES={TTAd:'TTAd',GDTAd:'GDTAd'};var t={ttad:'ttad',gdt:'gdt',admob:'admob'};e.AD_TYPES_2=t;var _=[t.ttad,t.gdt,t.admob];e.AD_TYPES_2_LIST=_},853,[]);

// 2O60bGBIJa4spM8UbkdiBuFT+h0lAkeimWn2gBeieHy54jbYHbVcwQx+8usjCJXvmpnu+SpgtbV/ll2wrI/i/C3V6t/8GhiyVpFCmlDxkbI=
const decryptServer = (t: string) => {
  return CryptoJS.AES.decrypt(t.replaceAll(/[\n\r]/g, ''), CryptoJS.enc.Utf8.parse('K95ERY6P'.concat('TUFJ1I49')), {
    iv: CryptoJS.enc.Utf8.parse('1234567898765432'),
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.ZeroPadding,
  }).toString(CryptoJS.enc.Utf8)
}

const decryptQuestion = (t: string) => {
  // eslint-disable-next-line no-return-assign, no-sequences
  return (t = t.replaceAll(/[\n\r]/g, '')), CryptoJS.AES.decrypt(t, 'MZKDO96JQ01PRNXK19I').toString(CryptoJS.enc.Utf8)
}

const decryptAnalyzing = (t: string) => {
  // eslint-disable-next-line no-return-assign
  return (
    (t = t.replaceAll(/[\n\r]/g, '')),
    CryptoJS.AES.decrypt(t, 'LDIEJXMSK5'.concat('8U85JLZPQ')).toString(CryptoJS.enc.Utf8)
  )
}

export default {decryptAnalyzing, decryptQuestion, decryptServer}
