// 第一回：林教頭風雪山神廟
import { npc, foe, boss, exit, chest, money, entry, sign, trig, gate, boulder, plate, reset, obj } from './mk.js';

const chapters = {
  1: { title: '林教頭風雪山神廟', sub: '八十萬禁軍教頭林沖，遭高太尉陷害，刺配滄州。' },
};

const quests = {
  q1_yuemiao: { name: '岳廟風波', desc: '錦兒來報：娘子在岳廟被人調戲！快往北邊的岳廟。' },
  q1_blade: { name: '寶刀', desc: '街上有個漢子在賣刀，去看看吧。' },
  q1_baihu: { name: '白虎節堂', desc: '高太尉要看寶刀。沿東邊大街往太尉府去。' },
  q1_yezhu: { name: '刺配滄州', desc: '被董超、薛霸押解，穿過野豬林往滄州去。' },
  q1_chai: { name: '小旋風柴進', desc: '路過柴進莊，拜會天下聞名的柴大官人。' },
  q1_cang: { name: '滄州牢城', desc: '到滄州牢城營報到。' },
  q1_luqian: { name: '東京來的人', desc: '李小二說有東京來的軍官鬼鬼祟祟。在滄州城打聽他們的下落。' },
  q1_wine: { name: '風雪沽酒', desc: '草料場天寒地凍，帶著酒葫蘆到東邊村店買酒。' },
  q1_miao: { name: '山神廟', desc: '草廳被大雪壓塌了，往西北的山神廟暫避風雪。' },
  s1_lu: { name: '菜園潑皮', desc: '大相國寺菜園有潑皮鬧事，幫魯智深出口氣。', side: true },
  s1_cang: { name: '滄州惡霸', desc: '滄州城裡的潑皮欺壓百姓，教訓他們。', side: true },
};

const scripts = {
  yuemiao: `
@if !flag:yuemiao_done
|岳廟前，一個衙內模樣的公子正攔著林娘子，不讓她走。
高衙內|小娘子，陪本衙內上樓吃杯酒，如何？
林娘子|光天化日，你、你調戲良家婦女，是何道理！
林沖|（扳過那人肩膀，舉拳便打）調戲良人妻子，當得何罪！
|拳頭將落，林沖看清了此人——竟是高太尉的乾兒子，高衙內。
林沖|……！
高衙內|林沖！你敢打本衙內？來人，給我教訓這個教頭！
@battle thug@1+thug@1 bg=bg_dongjing
潑皮|哎喲喲，衙內快走！
高衙內|好你個林沖……咱們走著瞧！
@flag yuemiao_done
林娘子|官人！
林沖|娘子莫怕。……唉，若不是他是太尉的乾兒子，我定要打他一頓。
林娘子|算了吧，咱們回家去。
@quest q1_yuemiao done
@quest q1_blade
|（過了幾日。林沖心中鬱悶，在街上閒逛。）
@end`,
  prologue: `
@bgm title
@cg bg_dongjing
@title 北宋・宣和年間/奸臣當道/高俅以踢球得寵，官拜殿帥府太尉。天下英雄，多被逼上梁山。
|東京汴梁，八十萬禁軍教頭林沖，槍棒天下無雙。
|這一日，他與新結拜的師兄——花和尚魯智深，在大相國寺菜園飲酒論武。
@chapter 1
@cg off
`,
};

const maps = {
  dongjing: {
    name: '東京汴梁', ch: 1, bg: 'bg_dongjing', bgm: 'town', ground: ',',
    grid: `
############################
#TT,,,,,RRRRRRRRR,,,,,,,,TT#
#T,,,,,,RRRRRRRRR,,,,,,,,,T#
#,,,,,,,RRRR+RRRR,,,,,,G,,,#
#,,,,,,,,,,UQU,,,,,,,,,,,,,#
#~~~~,,,,,,:::,,,,,,RRRRRR,#
#~~~~==,,,,YYY,,,,,,RRRRRR,#
#~~~~,,,,,,:::,,,,,,RRR+RR,#
#RRR+R:::::::::::::::::L:::#
#RRRRR:,,,,,::,,,,,,,,,,:,,#
#,W,1,:,RRRRR,:,RRRRRR,,:Z,#
#,,,,,:,RR+RR,:,RR+RRR,,:,,#
#K,,,,:,,,,S,,:,,,M,,,N,:,,#
#TT,,,:,,,,,,,:,,,,,,,,,:,,#
#,,,,,::::::::::::::::::::E#
#,,,,,,,,,,,,,,,,,,,,,,,,,,#
#TT,,,G,,,,,,,,,,,,,,G,,,TT#
############################`,
    marks: {
      '1': entry('start'),
      W: npc('林娘子', 'n_lady', `
@if flag:yuemiao_done
林娘子|官人，那高衙內是太尉的乾兒子，咱們惹不起……你千萬小心。
林沖|娘子放心，我自有分寸。
@else
林娘子|（林娘子不在家，錦兒說她去岳廟上香了……）
@end`, { show: 'flag:yuemiao_done' }),
      Q: npc('高衙內', 'b_ximenqing', `@run yuemiao`, { show: '!flag:yuemiao_done', ring: '#c33' }),
      U: npc('潑皮', 'e_thug', `@run yuemiao`, { show: '!flag:yuemiao_done', ring: '#c33' }),
      Y: trig(`@run yuemiao`, { cond: '!flag:yuemiao_done' }),
      S: npc('賣刀漢子', 'e_bandit', `
@if item:k_blade
賣刀漢子|好刀配好漢，教頭好眼力。
@else
賣刀漢子|好刀！好刀！可惜不遇識者，屈沉了我這口寶刀！
林沖|（接過刀一看，寒光奪目）……果然好刀！你要賣多少？
賣刀漢子|原要三千貫，便宜賣你一千貫吧。
林沖|此刀不凡，我買了。
@give k_blade
|林沖得了寶刀，愛不釋手。誰知第二天一早——
|兩個承局來到門前。
承局|林教頭，太尉聽說你買了一口好刀，叫你帶去府裡比看。太尉也有一口寶刀，正想比一比。
林沖|……太尉倒是消息靈通。好，我這就去。
@flag summoned
@quest q1_blade done
@quest q1_baihu
@end`, { show: 'flag:yuemiao_done', mark: true }),
      M: npc('掌櫃', 'n_waiter', `掌櫃|教頭要買些什麼？出門在外，傷藥燒餅總要備一些。
@shop dongjing`),
      N: npc('說書人', 'n_elder', `
說書人|話說這東京城裡，誰不知道八十萬禁軍教頭林沖的名號？
說書人|只是近來太尉府的人四處打聽教頭的事，老漢看著心裡發毛啊……
@if !flag:summoned
說書人|對了，聽說街上來了個賣刀的漢子，口氣大得很。
@end`),
      L: npc('魯智深', 'p_luzhishen', `
@if flag:s1_lu_done
魯智深|兄弟！那幫潑皮再也不敢來菜園搗亂了，哈哈哈！
@elif flag:yuemiao_done
魯智深|兄弟，聽說高衙內那廝欺負弟妹？灑家這就去打他三百禪杖！
林沖|師兄息怒！他是高太尉的乾兒子，不可造次。
魯智深|呸！這等鳥人……兄弟，你若有事，只管來大相國寺找灑家！
@if !qactive:s1_lu
魯智深|對了，菜園那邊又來了幾個潑皮，灑家懶得理，兄弟替灑家趕走他們吧。
@quest s1_lu
@end
@else
魯智深|兄弟，咱們繼續喝！……咦，那不是你家錦兒嗎？
錦兒|官人！官人！不好了！娘子在岳廟被人攔住了！
林沖|什麼？！
@quest q1_yuemiao
@end`, { mark: false }),
      Z: foe('thug@2+thug@2', { name: '菜園潑皮', post: `
潑皮|饒命！我們再也不敢到菜園撒野了！
@flag s1_lu_done
@quest s1_lu done
@gold 30` }),
      G: foe('thug@1+dog@1'),
      K: chest('herb', 2),
      E: exit('baihutang', 'start', '太尉府', { cond: 'flag:summoned', deny: '|往太尉府的路。無事最好別靠近。' }),
    },
    intro: `
魯智深|兄弟，灑家這倒拔垂楊柳的力氣，比你的林家槍如何？哈哈哈！
林沖|師兄神力，林沖佩服。
錦兒|官人！官人！不好了！娘子在岳廟讓人攔住了，不讓走！
林沖|什麼？！師兄，我去去就回！
魯智深|快去！灑家隨後就到！
@quest q1_yuemiao
|【操作】點擊地圖移動，點人物對話；或用方向鍵移動、「調查」鍵互動。岳廟在北邊。`,
  },

  baihutang: {
    name: '太尉府・白虎節堂', ch: 1, bg: 'bg_baihutang', bgm: 'dungeon', ground: ':',
    grid: `
###############
#RRRRRRRRRRRRR#
#RRRRRR+RRRRRR#
#:::::::::::::#
#:::::BBB:::::#
#::A:::::::A::#
#:::::::::::::#
#::A:::::::A::#
#:::::::::::::#
#::A::C::::A::#
#:::::::::::::#
######:1:######
###############`,
    marks: {
      '1': entry('start'),
      A: npc('府兵', 'e_soldier', `府兵|太尉在堂上等候，教頭請往裡走。`),
      C: sign('白虎節堂——商議軍機大事之處。無故擅入者，斬！', { glyph: '令' }),
      B: trig(`
|林沖捧著刀，跟著承局一路往裡走，回過神來，竟已站在一座大堂前。
林沖|（抬頭一看，匾上四個青字：「白虎節堂」）……這是商議軍機的重地，我怎能擅入？
林沖|（轉身欲退）
高俅|林沖！你又無呼喚，安敢輒入白虎節堂？你手裡拿著刀，莫非是來刺殺本官！
林沖|恩相明鑑！是兩個承局喚小人來比刀的！
高俅|胡說！我府中哪有什麼承局！左右，給我拿下！
@battle soldier@2+soldier@2+soldier@3 nolose bg=bg_baihutang
@if result:win
|林沖打倒了幾名府兵，卻見堂外湧進上百名禁軍，刀槍齊舉。
@end
林沖|……罷了。林沖一身清白，到了開封府自有公論！
@cg bg_baihutang
|開封府尹知道林沖冤屈，卻不敢得罪太尉。最後判了個「手持利刃，誤入節堂」——
|脊杖二十，刺配滄州牢城。
林娘子|官人……
林沖|娘子，我此去生死未卜，不能誤了你的青春。我寫下休書，你另尋好人家吧。
林娘子|官人說的什麼話！我生是林家人，死是林家鬼，我在家等你回來！
|兩個公人——董超、薛霸押著林沖上路。他們卻不知道，陸虞候早已暗中給了二人十兩金子……
@cg off
@quest q1_baihu done
@quest q1_yezhu
@goto yezhulin start`),
    },
  },

  yezhulin: {
    name: '野豬林', ch: 1, bg: 'bg_yezhulin', bgm: 'field', ground: ',',
    grid: `
##############################
#FFFFFFFFFFFFFE,FFFFFFFFFFFFF#
#FFFFFFFFFFFFF,,,FFFFFFFFFFFF#
#FFFF,,e,,FFF,,,,,FFF,,,,K,FF#
#FFF,,T,,,,,,,,,,,,,,,,T,,,FF#
#FF,,,,,,,FFF,,,,,FFF,,,d,,FF#
#FF,J,,,T,FFF,,H,,FFF,,,,,FFF#
#FFF,,,,,,FFF,,,,,FFFF,,,FFFF#
#FFFFFFFFFFFFF,,,FFFFFFFFFFFF#
#FFFFF,,FFFFFF,D,FFFFFFF,,,FF#
#FF,,,,,,,FFFFFYFFFFFF,,,,,,F#
#F,,b,,,,,,,,,,,,,,,,,,,,T,,F#
#F,,,,FFFF,,,,,,,,,FFFF,,,,,F#
#F,T,,FFFF,~~~~==~~FFFF,,c,,F#
#F,,,,FFFF,~~~~,,~~FFFF,,,,,F#
#FF,,FFFFF,,,,,,,,,FFFFF,,FFF#
#FF,,FFFFF,,,a,,,,,FFFFF,,FFF#
#FC,,,,,,,,,,,,,,,,,,,,,,,,BF#
#FF,,FFFFFFFFF,,,FFFFFFFFF,,F#
#FFFFFFFFFFFFF,1,FFFFFFFFFFFF#
##############################`,
    marks: {
      '1': entry('start'),
      E: exit('chaijin', 'start', '柴進莊', { cond: 'flag:lu_left', deny: '@if flag:yezhu_done\n魯智深|兄弟，等等灑家！灑家有話跟你說。\n@else\n|往北是滄州的方向。\n@end' }),
      D: npc('董超', 'e_yamen', `
@if flag:yezhu_done
@else
董超|走快些！磨磨蹭蹭的，誤了日子，又要吃棍棒！
薛霸|前面林子裡歇一歇……嘿嘿。
@end`, { show: '!flag:yezhu_done' }),
      Y: trig(`
董超|林教頭，這林子裡歇一歇吧。只是我們要睡一會兒，怕你逃了，得把你綁在樹上。
林沖|……二位要綁便綁，林沖不會逃。
|董超、薛霸用繩子將林沖連手帶腳綁在一棵大樹上。
薛霸|（抽出水火棍）林教頭，休要怪我們。是陸虞候傳下高太尉的鈞旨，教我們在這裡結果了你。
董超|明年今日，便是你的週年！
林沖|（閉目長嘆）林沖與你們往日無冤，近日無仇，你們若救得我，生死不忘！
薛霸|說什麼閒話，救你不得！
@shake
|水火棍正要落下——松林背後雷鳴也似一聲，一條鐵禪杖飛將過來，把那棍一隔，丟去九霄雲外！
魯智深|灑家在林子裡聽你多時了！
林沖|師兄！！
魯智深|兄弟，灑家放心不下你，一路跟到此處。這兩個撮鳥，看灑家打死他們！
@join luzhishen
@battle dongxue+xueba bg=bg_yezhulin
董超|好漢饒命！是陸謙那廝逼我們的！
魯智深|呸！灑家一禪杖下去，你們腦袋便是這棵松樹！
林沖|師兄，且饒他們。他們也是被人所逼。
魯智深|……哼！看在兄弟面上！你二人老老實實把林兄弟送到滄州，要是再起歹心——
@shake
|魯智深一禪杖打在松樹上，碗口粗的樹幹齊齊折斷！
董超|是是是！小的一定好好伺候教頭！
@flag yezhu_done
魯智深|兄弟，灑家護送你出了這片林子再說。
@heal`, { cond: '!flag:yezhu_done' }),
      H: npc('魯智深', 'p_luzhishen', `
魯智深|這林子出去，往北便是柴大官人的莊子。灑家要回大相國寺了。
@if party:luzhishen
魯智深|兄弟，保重！灑家在東京等你回來喝酒！
林沖|師兄救命之恩，林沖沒齒難忘！
@leave luzhishen
@flag lu_left
@hide H
@end`, { show: 'flag:yezhu_done & !flag:lu_left', mark: true }),
      J: npc('樵夫', 'n_villager', `樵夫|這野豬林兇險得很，常有公人在此害了犯人性命……客官小心。
樵夫|往東邊小溪那頭，聽說有人藏了東西。`),
      a: foe('wolf@2'),
      b: foe('wolf@2+snake@2'),
      c: foe('boar@3'),
      d: foe('boar@4+wolf@4'),
      e: foe('snake@4+wolf@4+wolf@3'),
      K: chest('herb', 3),
      C: money(40),
      B: chest('wine', 2),
    },
    intro: `
|野豬林——東京往滄州必經的一片惡林。煙籠霧鎖，前不見村，後不著店。
薛霸|快走！前面就是野豬林了。
|（林子裡有野獸出沒。帶著紅色光環的是敵人，靠近就會開戰。）`,
  },

  chaijin: {
    name: '柴進莊', ch: 1, bg: 'bg_village', bgm: 'town', ground: ',',
    grid: `
##########################
#TT,,,,,RRRRRRRRRR,,,,,TT#
#T,,,,,,RRRRRRRRRR,,,,,,T#
#,,,,,,,RRRRR+RRRR,,,,,,,#
#,,K,,,,,,,,C,,,,,,,,,,,,#
#,,,,,,,,,,:::,,,,,,,,,,,#
#,,,,::::::::::::::::,,,,#
#,,,,:,,,,,,,,,,,,,,:,,,,#
#,,,,:,,H,,,,,,,,G,,:,,,,#
#,,,,:,,,,,,,,,,,,,,:,,,,#
#,,,,::::::::::::::::,,,,#
#,,,,,,,,,,:::,,,,,,,,,,,#
#,Z,,,,,,,,:::,,,,,,,,P,,#
#TTTT,,,,,,:::,,,,,,TTTTT#
#TTTTTT,,,,:1:,,,,,TTTTTT#
#TTTTTTTTT,,E,,TTTTTTTTTT#
##########################`,
    marks: {
      '1': entry('start'),
      C: npc('柴進', 'n_noble', `
@if flag:hong_done
柴進|教頭神技，柴進大開眼界！這封書信你收好，將來若有難處，可往梁山泊投奔王倫。
柴進|滄州的管營、差撥都與我交好，有我的書信，他們不會為難你。
@else
柴進|久聞林教頭大名，今日得見，三生有幸！
林沖|大官人言重了。林沖是戴罪之人，怎敢當此禮遇。
柴進|哪裡話！來人，擺酒！……對了，莊上有位洪教頭，自稱槍棒第一，教頭可願與他切磋一番？
@end`, { img: 'n_elder' }),
      H: npc('洪教頭', 'b_commander', `
@if flag:hong_done
洪教頭|……我、我服了。
@else
洪教頭|哼，什麼八十萬禁軍教頭？不過是個配軍！大官人何必待他如上賓！
林沖|……
柴進|二位既是教頭，就在月光下比試一回，讓大家見識見識！
洪教頭|來，來，來！
柴進|（取出二十五兩銀子）誰贏了，這錠銀子便是誰的！
林沖|小人斗膽，請洪教頭賜教。
@battle hong bg=bg_village
|林沖手中棒一掃，正中洪教頭小腿骨，洪教頭撲地便倒！
柴進|好！好！林教頭真乃天下無雙！
洪教頭|（滿面羞慚，自投莊外去了）
@flag hong_done
@gold 25
@give k_letter
柴進|教頭，我修書兩封，一封給滄州管營，一封……若將來無處容身，可去梁山泊投奔。
林沖|大官人厚恩，林沖銘記！
@quest q1_chai done
@quest q1_cang
@hide H
@end`, { ring: '#c33', show: '!flag:hong_gone' }),
      G: npc('莊客', 'e_militia', `莊客|大官人最愛結交天下好漢，凡是流配來的犯人，都來莊上住幾日。
莊客|後院有些練武用的東西，教頭若需要，儘管取用。`),
      K: chest('armor1', 1),
      Z: chest('amulet', 1),
      P: npc('董超', 'e_yamen', `
董超|教頭，咱們該上路了，滄州城就在南邊……
@if !flag:hong_done
董超|（柴大官人的面子大，我們也不敢催……）
@end`),
      E: exit('cangzhou', 'start', '滄州城', { cond: 'flag:hong_done', deny: '董超|教頭，柴大官人還在莊上等你呢。' }),
    },
    intro: `
|一路上董超、薛霸不敢再起歹心。這日來到一座大莊院——正是「小旋風」柴進的莊子。
|柴進乃後周皇族之後，仗義疏財，專愛結交天下好漢。
@quest q1_yezhu done
@quest q1_chai`,
  },

  cangzhou: {
    name: '滄州城', ch: 1, bg: 'bg_cangzhou', bgm: 'town', ground: '.',
    grid: `
############################
#RRRRRR,,,,,,,,,,,RRRRRRRRR#
#RRRRRR,,,,G,,,,,,RRRRRRRRR#
#RR+RRR,,,,,,,,,,,RRRR+RRRR#
#,,A,,,,::::::::,,,,,,B,,,,#
#,,,,,,,:,,,,,,:,,,,,,,,,,,#
#,,,,,,,:,,C,,,:,,,,,,,,,K,#
#:::::::::::::::::::::::::::#
#,,,,,,,,,,:,,,,,,,,,:,,,,,#
#,RRRRR,,,,:,,,,,RRRRR,,,,,#
#,RRRRR,,D,:,,,,,RR+RR,,,,,#
#,RR+RR,,,,:,,,,,,,E,,,,Z,,#
#,,H,,,,,,,:,,,,,,,,,,,,,,,#
#TT,,,,,,,,:,,,,,,,,,,,,,TT#
#TTT,,,,,,,:,,,,,,,,,,,,TTT#
#TTTT,,,,,,1,,,,,,,,,,,TTTT#
#TTTTTTTT,,X,,TTTTTTTTTTTTT#
############################`,
    marks: {
      '1': entry('start'),
      A: npc('李小二', 'n_waiter', `
@if !flag:cang_report
李小二|恩人！您不是東京的林教頭嗎？當年小人在東京偷了店主人的錢，是恩人替我賠錢、還給了盤纏！
林沖|你是……李小二？你怎麼在滄州？
李小二|小人流落到此，開了這間小酒店。恩人有什麼需要，只管說！
林沖|好。我先去牢城營報到，日後再來。
@elif flag:luqian_seen & !flag:luqian_done
李小二|恩人，那兩個東京人說話鬼鬼祟祟，我聽到「高太尉」、「結果他性命」幾個字……
李小二|後來他們給了差撥一包金銀走了。城裡有人見過他們，恩人去打聽打聽吧。
@elif flag:luqian_done
李小二|恩人，聽說您調去看守草料場了？那地方偏僻，夜裡千萬小心。
@end
@choice 吃點東西、休息（10 兩）|買些東西|不用了
@if choice:1
@inn 10
@elif choice:2
@shop cangzhou
@end`),
      B: npc('牢城營管營', 'b_commander', `
@if !flag:cang_report
差撥|新來的配軍！見了我還不跪下！按規矩，先打一百殺威棒！
林沖|（取出柴進的書信）差撥哥哥，這裡有柴大官人的書信。
差撥|柴大官人？……哼，信我收了。不過殺威棒的規矩，可不是一封信就免得了的。
@choice 送他五兩銀子|不送（準備動手）
@if choice:1 & gold:5
@gold -5
差撥|嘿嘿，林教頭是明白人。好說，好說。
@else
差撥|好個不識相的配軍！給我打！
@battle chabo bg=bg_cangzhou
差撥|……你、你等著！
@end
|管營看了柴進的信，免了林沖的殺威棒，派他去看守天王堂，十分清閒。
@flag cang_report
@quest q1_cang done
|過了些日子——
李小二|（跑來）恩人！今天店裡來了兩個東京口音的人，請差撥和管營喝酒，說話鬼鬼祟祟的！
林沖|東京來的？長什麼樣？
李小二|一個像是軍官，五短身材，白淨面皮；一個像是僕從……
林沖|……五短身材、白淨面皮——那是陸虞候陸謙！他竟追到滄州來害我！
@flag luqian_seen
@quest q1_luqian
@elif flag:luqian_done & !flag:caoliao_go
管營|林沖，你來營中多時，柴大官人面上，我派你去東門外十五里的大軍草料場，比天王堂還輕鬆，每月有些常例錢。
林沖|（草料場……也好，遠離是非。）多謝管營。
@flag caoliao_go
@quest q1_luqian done
@quest q1_wine
@else
管營|好好當差，莫要生事。
@end`),
      C: npc('賣菜老漢', 'n_elder', `
@if flag:luqian_seen & !flag:clue1
老漢|東京來的兩位官人？前兩天在城北客店住過，昨天一早就退房了。
老漢|聽店家說他們往東門那邊去了，臨走還買了火石火鐮……奇怪，大白天買那個做啥？
@flag clue1
@else
老漢|滄州地方不大，有什麼新鮮事都瞞不過老漢。
@end`),
      D: npc('村婦', 'n_woman', `
@if flag:luqian_seen & !flag:clue2
村婦|那個軍官模樣的？見過見過，他向我打聽草料場怎麼走，我還奇怪呢。
@flag clue2
@else
村婦|最近天冷，聽說要下大雪了。
@end`),
      H: npc('牢頭', 'e_yamen', `
@if flag:luqian_seen & !flag:clue3
牢頭|那差撥最近闊氣得很，喝醉了說什麼「草料場那邊，包管教他……」話沒說完就睡了。
@flag clue3
@else
牢頭|配軍也有配軍的活法，林教頭是個體面人。
@end`),
      E: trig(`
@if flag:clue1 & flag:clue2 & flag:clue3 & !flag:luqian_done
林沖|火石火鐮……草料場……差撥的醉話……
林沖|陸謙！你若敢來，我林沖定叫你粉身碎骨！
|林沖買了一把解腕尖刀帶在身上，在城裡四處尋了三五日，卻再不見陸謙蹤影，心下漸漸放鬆了。
@flag luqian_done
林沖|（先回牢城營看看吧。）
@end`, { once: false }),
      G: foe('thug@4+thug@3', { name: '潑皮', post: `
潑皮|好漢饒命！我們再也不敢在城裡收保護費了！
@flag s1_cang1` }),
      Z: foe('thug@4+dog@4+thug@4', { name: '惡霸', post: `
|城裡的百姓都拍手叫好。
@quest s1_cang done
@gold 40` }),
      K: chest('pill', 1),
      X: exit('caoliao', 'start', '草料場', { cond: 'flag:caoliao_go', deny: '|城外是荒野，無事不可擅離牢城。' }),
    },
    intro: `
|滄州牢城到了。董超、薛霸交割了公文，灰溜溜地回東京去了。
@quest q1_chai done
@quest s1_cang
|（打聽線索時，記得和城裡每個人說說話。）`,
  },

  caoliao: {
    name: '大軍草料場', ch: 1, bg: 'bg_caoliao', bgm: 'snow', ground: '*', weather: 'snow',
    grid: `
##############################
#^^^^^^^^^^^^^^^^^^^^^^^^^^^^#
#^E,,***T*****************^^^#
#^**********T***G*****T****^^#
#^****TT*************,,,****^#
#^**G*****RRRRR*******T*****^#
#^********RRRRR********G****^#
#^***T****RR+RR*************^#
#^********,,H,,*****TTT*****^#
#^*****K**,,,,,**T**TTT**N**^#
#^******************TTT*RRR*^#
#^**TT********************+*^#
#^*************G**********W*^#
#^****G****TTT**************^#
#^*********TTT*****T****C***^#
#^************************T*^#
#^^^^^^^^^^^^^1^^^^^^^^^^^^^^#
##############################`,
    marks: {
      '1': entry('start'),
      H: npc('老軍', 'n_elder', `
@if !flag:cl_keys
老軍|你就是新來的林教頭？這草料場交給你了。這裡天寒，我留個酒葫蘆給你。
@give k_gourd
老軍|往東走二三里有個村店，可以去打酒。小心路上的餓狼。
林沖|多謝老哥。
@flag cl_keys
@elif flag:hut_down
|（草廳已經被大雪壓塌了，老軍也已回營。）
@else
老軍|東邊村店的酒不錯，天冷喝兩口暖暖身子。
@end`, { show: '!flag:hut_down' }),
      N: npc('店家', 'n_waiter', `
@if item:k_gourd
店家|客官認得這個葫蘆？這是草料場老軍的。來，給您裝滿了，再切二斤熟牛肉。
@take k_gourd
@give k_wine
林沖|（付了錢，掛上葫蘆，挑著花槍往回走。）
@quest q1_wine done
@else
店家|風雪這麼大，客官進來暖暖身子吧。
@end
@choice 歇一歇（免費）|買東西|不用了
@if choice:1
@inn 0
@elif choice:2
@shop cangzhou
@end`),
      W: trig(`
@if item:k_wine & !flag:hut_down
|林沖挑著酒葫蘆往回走，雪下得越發緊了。
|回到草料場一看——兩間草廳竟已被大雪壓倒！
@flag hut_down
@tile 10 5 ^
@tile 11 5 ^
@tile 12 5 ^
@tile 13 5 ^
@tile 14 5 ^
@tile 12 7 ^
林沖|天理昭然，佑護善人義士！若我在屋裡，豈不被壓死！
林沖|（翻出一條絮被）……先去西北邊半里路的山神廟過一夜，明早再作理會。
@quest q1_miao
@end`, { once: false }),
      G: foe('wolf@5+wolf@5'),
      K: chest('herb', 2),
      C: chest('wine2', 1),
      E: exit('shanshenmiao', 'start', '山神廟', { cond: 'flag:hut_down', deny: '|西北邊是座古廟。天色尚早，先把差事辦好。' }),
    },
    intro: `
|大軍草料場，在滄州東門外十五里。正是嚴冬天氣，彤雲密布，朔風漸起，紛紛揚揚捲下一天大雪來。
@quest q1_wine`,
  },

  shanshenmiao: {
    name: '山神廟', ch: 1, bg: 'bg_shanshenmiao', bgm: 'snow', ground: '_', night: true,
    grid: `
#############
#^^^^^^^^^^^#
#^____X____^#
#^_________^#
#^_____O___^#
#^__B______^#
#^_________^#
#P_________^#
#^____1____^#
#^^^^^D^^^^^#
#*****Y*****#
#***********#
#############`,
    marks: {
      '1': entry('start'),
      X: obj('statue', '一尊金甲山神，兩邊一個判官、一個小鬼。供桌上積滿了灰。', { name: '山神像', scale: 1.1 }),
      B: boulder(),
      P: plate({ under: '_' }),
      O: reset(),
      D: gate('flag:miao_out', '|大雪封門。外面風聲呼嘯——不，似乎還有別的聲音……'),
      Y: trig(`
|林沖挺著花槍，猛地推開廟門，大喝一聲：
林沖|潑賊哪裡去！
差撥|林、林沖？！他怎麼沒燒死？！
@battle chabo+thug@6 bg=bg_shanshenmiao
富安|陸大人快走！
@battle fuan bg=bg_shanshenmiao
陸謙|林教頭……饒命！不干我事，是太尉差遣，不敢不來！
林沖|奸賊！我與你自幼相交，今日倒來害我，怎不干你事！
@battle luqian bg=bg_shanshenmiao
|林沖將陸謙、富安、差撥三人的首級供在山神面前，將葫蘆裡的冷酒一飲而盡。
林沖|（望著漫天大雪，長嘆）天下雖大，再無我林沖容身之處……
林沖|柴大官人說過，梁山泊……
@cg bg_marsh
|林沖提了花槍，冒著漫天風雪，投東而去。
|——正是：「天理昭然不可誣，莫將奸惡作良圖。」
@quest q1_miao done
@exp 60
@flag ch1_done
@cg off
@title 第一回・終/林沖雪夜上梁山/林沖的故事暫告一段落。他的身影，將在梁山泊重新出現。
@run ch2_start`),
    },
    intro: `
|林沖推開廟門，冷風夾著雪片灌了進來。廟裡破敗不堪，西牆有個大破洞，寒風直往裡灌。
林沖|這破洞得堵上，不然今晚要凍死在這裡。……那塊大石頭倒是合用。
|【謎題】把大石頭推到牆邊破洞前的位置（朝石頭方向走就能推）。推錯了可以調查「重擺石頭」。`,
    onSolve: `
|大石頭穩穩堵住了破洞，風聲小了許多。林沖把門也用石頭頂住，蓋上絮被，取出牛肉，喝起冷酒。
@wait 400
@shake
|——忽聽外面必必剝剝地爆響！林沖從壁縫往外看，只見草料場那邊火光沖天！
林沖|草料場起火了！得去救火……
|正要開門，卻聽廟門外有三個人的腳步聲，靠在門上說話。
差撥|這條計好麼？
陸謙|端的虧管營、差撥兩位用心！回到京師，稟過太尉，都保你二位做大官。
富安|林沖今番直吃我們對付了！高衙內這病必然好了。
差撥|我親手點了十來個火把，就算他逃得性命，燒了大軍草料場，也是個死罪！
林沖|（渾身發抖，怒不可遏）……陸謙！富安！
|林沖輕輕挪開頂門的石頭，握緊了花槍——
@flag miao_out
@heal`,
  },
};

export default { maps, scripts, quests, chapters };
