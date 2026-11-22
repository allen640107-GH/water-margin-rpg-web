// 第五回：梁山泊好漢劫法場（清風寨、江州、潯陽江、江州法場）
import { npc, foe, boss, exit, chest, money, entry, sign, trig, gate, boulder, plate, reset, obj, sw } from './mk.js';

const chapters = {
  5: { title: '梁山泊好漢劫法場', sub: '「及時雨」宋江，仗義疏財，扶危濟困。命運卻一次次將他推向絕境。' },
};

const quests = {
  q5_lantern: { name: '清風寨元宵', desc: '宋江在花榮的清風寨作客。元宵夜，到寨中看花燈。' },
  q5_liugao: { name: '劉高的恩將仇報', desc: '宋江被劉高誣陷。打進劉高的寨子，討個公道。' },
  q5_jiangzhou: { name: '刺配江州', desc: '宋江被刺配江州。在江州認識當地的好漢。' },
  q5_poem: { name: '潯陽樓', desc: '到潯陽樓上吃酒，看看江景。' },
  q5_rescue: { name: '劫法場', desc: '宋江、戴宗將被斬首！梁山好漢殺入江州法場救人。' },
  q5_shan: { name: '清風山', desc: '翻過清風山往清風寨去。山上有強人出沒。' },
  s5_lamp: { name: '走失的孩子', desc: '元宵燈會上有個孩子走失了，替他娘找回來。', side: true },
  s5_market: { name: '江州魚市', desc: '江州魚市被惡霸把持，漁民苦不堪言。', side: true },
};

const scripts = {
  ch5_start: `
@chapter 5
@party songjiang
@heal
@cg bg_qingfeng
|鄆城縣押司宋江，人稱「及時雨」。他因殺了逼迫勒索的閻婆惜，逃離家鄉。
|他要往清風寨投奔舊友——「小李廣」花榮。路上，須經過強人出沒的清風山。
@cg off
@goto qingfengshan start`,
  ch5_end: `
@party songjiang,linchong,likui,wuyong+
@heal
@cg bg_juyiting
|眾好漢救了宋江、戴宗，又在無為軍拿了黃文炳，一齊回到梁山泊。
晁蓋|宋三郎！今日總算把你請上梁山了！
宋江|宋江何德何能，勞眾兄弟捨命相救！
晁蓋|當初若非賢弟冒死報信，哪有今日的梁山？這頭把交椅，該你來坐！
宋江|哥哥休如此說！論年齒，哥哥長宋江十歲；論功勞，哥哥是山寨之主。宋江只坐第二位便好。
李逵|哥哥做了大宋皇帝，晁蓋哥哥做小宋皇帝——咱們殺去東京，奪了鳥位！
宋江|（喝道）黑廝！又來胡說！
|眾人大笑。梁山泊排下筵席，連續慶賀了三日。
@cg off
@title 第五回・終/白龍廟小聚會/梁山聲勢大振。然而，獨龍岡上的祝家莊，已經向梁山發出了挑戰……
@flag ch5_done
@chapter 6
@quest q6_rooster
@goto juyiting start`,
};

const maps = {
  qingfengshan: {
    name: '清風山', ch: 5, bg: 'bg_mountainfort', battleBg: 'bg_yezhulin', bgm: 'field', ground: ',',
    grid: `
##########################
#^^^^^^^^^^RRRRRR^^^^^^^^#
#^^TT,,,,,,RR+RRR,,,,TT^^#
#^T,,,,,,,,,,Y,,,,,,,,,T^#
#^,,,A,,,,,,,,,,,,,,B,,,^#
#^^^,,,,,,^^^^^^,,,,,,^^^#
#^^^^,,,,,^^^^^^,,,,,^^^^#
#^^FFF,,,,,,,,,,,,,FFF,^^#
#^FFFF,,G,,,FFF,,,,FFFK^^#
#^FFF,,,,,,FFFFF,,,,,,,^^#
#^FF,,,T,,,,FFF,,,H,,,F^^#
#^F,,,,,,,,,,,,,,,,,,,FF^#
#^FF,,J,,,,FFFF,,,,,,,FF^#
#^FFF,,,,,FFFFFF,,,Z,,FF^#
#^FFFF,,,,,,X,,,,,,,,FFF^#
#^FFFFFFF,,,,,,,,,FFFFFF^#
#^^^^^^^^^^E1^^^^^^^^^^^^#
##########################`,
    marks: {
      '1': entry('start'),
      E: exit('qingfeng', 'start', '清風寨', { cond: 'flag:qfs_wang', deny: '@if flag:qfs_caught\n燕順|哥哥別急著走，再住幾日！（山寨後堂似乎有什麼動靜。）\n@else\n|來時的路。清風寨在山的另一頭。\n@end' }),
      X: trig(`
@if !flag:qfs_caught
|宋江走到半山，腳下忽然被一條絆腳索絆倒——林子裡跳出十幾個嘍囉！
嘍囉|拿住了！拿住了！又是一頭肥羊！
@battle bandit@14+bandit@13 nolose bg=bg_yezhulin
|宋江寡不敵眾，被嘍囉們綁了，押上山寨。
@flag qfs_caught
@heal
燕順|（大寨裡，三個頭領坐在交椅上）綁來的這個黑漢子，挖了心肝做醒酒湯！
宋江|（長嘆）可惜宋江死在這裡！
燕順|……等等！你說你叫什麼？
宋江|在下鄆城宋江。
燕順|莫不是山東「及時雨」宋公明？！
宋江|正是。
|燕順大驚，奪過嘍囉手中的刀，親自割斷繩索，扶宋江坐在正中交椅上，納頭便拜。
燕順|小弟燕順，人稱「錦毛虎」。這兩位是王英、鄭天壽。我們只恨不能早識哥哥！
|宋江在清風山住了幾日。山寨中的嘍囉，有的不服，有的佩服——山裡也還有些野獸和不服管束的散兵遊勇。
@quest q5_shan
@end`),
      A: npc('燕順', 'e_bandit', `
@if flag:qfs_wang
燕順|哥哥此去清風寨，若有難處，派人送個信來，清風山兄弟立刻下山！
@else
燕順|哥哥在山寨多住幾日！咱們兄弟好好喝幾杯！
燕順|只是那王英兄弟……他好色，前日又下山去搶什麼人了。
@end`, { show: 'flag:qfs_caught', tint: 'hue-rotate(30deg) saturate(1.5)' }),
      B: npc('鄭天壽', 'e_thug', `鄭天壽|小弟鄭天壽，人稱「白面郎君」。山後的林子裡有幾隻豹子，常來偷山寨的羊。`, { show: 'flag:qfs_caught', tint: 'brightness(1.2)' }),
      Y: trig(`
@if flag:qfs_caught & !flag:qfs_wang
|山寨後堂傳來婦人的哭聲。
王英|（矮腳虎王英正拉著一個婦人）哈哈，這是清風寨知寨的老婆，我搶來做壓寨夫人！
宋江|王英兄弟！好漢不可貪女色。清風寨的知寨與我的朋友花榮是同僚，看在宋江的面上，放她回去吧！
王英|這……
燕順|王英，哥哥都開口了！
王英|唉……罷了罷了，聽哥哥的。
劉高|（那婦人連聲道謝，被轎子抬下山去了。）
|——宋江救了劉高之妻。他卻不知道，此舉將為自己招來大禍。
@flag qfs_wang
@quest q5_shan done
燕順|哥哥要往清風寨，下山的路在南邊。路上小心！
@end`, { once: false }),
      G: foe('wolf@14', { show: 'flag:qfs_caught' }),
      H: foe('leopard@14', { name: '山豹', show: 'flag:qfs_caught' }),
      J: foe('bandit@14', { name: '散兵遊勇', show: 'flag:qfs_caught' }),
      Z: foe('boar@14', { show: 'flag:qfs_caught' }),
      K: chest('sword2', 1),
    },
    intro: `
|清風山。山高林密，人跡罕至。
宋江|聽說這山上有強人……天色已晚，只得硬著頭皮過去了。`,
    onEnter: `
@if flag:qfs_wang
|（下山往南，便是清風寨。）
@end`,
  },

  qingfeng: {
    name: '清風寨', ch: 5, bg: 'bg_qingfeng', bgm: 'town', ground: ',',
    grid: `
############################
#^^^^^^^RRRRRRRRRR^^^^^^^^^#
#^^,,,,,RRRRRRRRRR,,,,,,K^^#
#^,,,,,,RRRRR+RRRR,,,,,,,,^#
#^,,G,,,,,,,,Y,,,,,,,,H,,,^#
#^,,,,,,,,,,,P,,,,,,,,,,,,^#
#^^^^^^^^^^^^D^^^^^^^^^^^^^#
#^,,,,,,,,,,,:,,,,,,,,,,,,^#
#^,RRRR,,,,,:::,,,,,RRRR,,^#
#^,RR+R,,,,:::::,,,,R+RR,,^#
#^,,A,,,,,::::L::,,,,B,,,,^#
#^,,,,,,,,,:::::,,,,,,,,,,^#
#^,,,,C,,,,,:::,,,,,,W,,,,^#
#^TT,,,,,,,,,:,,,,,,,,,,TT^#
#^,,,,,J,,,,,:,,,,,,Q,,,,,^#
#^TTT,,,,,,,,1,,,,,,,,,,TT^#
#^^^^^^^^^^^^^^^^^^^^^^^^^^#
############################`,
    marks: {
      '1': entry('start'),
      A: npc('花榮', 'p_huarong', `
@if flag:lg_done
花榮|哥哥，劉高已除。只是……他的上司黃信必定會來報復。
@elif flag:qf_caught
花榮|哥哥受苦了！劉高那廝，我花榮跟他沒完！他的寨子在北邊，我已經把寨門射開了！
@else
花榮|哥哥今晚去看花燈吧。只是……那劉高的老婆，哥哥最好避著些。
@end`),
      B: npc('花燈小販', 'n_waiter', `
@if flag:qf_caught
小販|宋押司是好人，劉知寨卻是個貪官……
@else
小販|客官，買盞燈吧！今年清風寨的燈，是十年來最熱鬧的！
@end
@choice 看看貨|不用了
@if choice:1
@shop jiangzhou
@end`),
      C: npc('哭泣的婦人', 'n_woman', `
@if quest:s5_lamp
婦人|謝謝恩人找回我家虎兒！這是我家傳的護身符，請收下！
@elif flag:kid_found
婦人|虎兒！我的虎兒！（抱著孩子大哭）恩人大恩大德！
@give jade
@quest s5_lamp done
@else
婦人|我家虎兒在燈會上走散了……您看見一個穿紅襖的小孩了嗎？
@if !qactive:s5_lamp
@quest s5_lamp
@end
@end`),
      K: npc('紅襖小孩', 'n_waiter', `
@if !flag:kid_found
小孩|嗚嗚……我找不到娘了……
宋江|莫哭，叔叔帶你去找娘。
@flag kid_found
@hide K
@end`, { show: 'qactive:s5_lamp & !flag:kid_found' }),
      L: trig(`@run qf_lantern`, { cond: '!flag:qf_caught' }),
      W: npc('寨兵', 'e_soldier', `寨兵|花知寨箭法如神，能百步穿楊。劉知寨卻只會搜刮百姓……`),
      J: chest('herb', 4),
      G: foe('soldier@19+archer@19', { name: '劉高寨兵', show: 'flag:qf_caught' }),
      H: foe('soldier@19+soldier@19+archer@18', { name: '劉高寨兵', show: 'flag:qf_caught' }),
      P: foe('armored@19+soldier@19', { name: '守門寨兵', show: 'flag:qf_caught' }),
      D: gate('flag:qf_caught', '|劉知寨的寨子。寨門緊閉。'),
      Y: trig(`
@if flag:qf_caught & !flag:lg_done
劉高|花榮！你一個武知寨，敢打進文知寨的衙門！
花榮|劉高！宋大哥救了你老婆的命，你卻恩將仇報，把他吊起來打！今天我花榮不射你個透明窟窿，誓不為人！
@battle liugao bg=bg_qingfeng
|劉高大敗而逃，後被清風山燕順所殺。
@flag lg_done
@quest q5_liugao done
@exp 120
|然而，青州兵馬都監黃信、秦明接連來攻。宋江、花榮與清風山眾人合兵一處，大破官軍，商議投奔梁山——
|就在此時，宋江接到家書：父親病故。宋江大哭一場，連夜趕回鄆城……
|——家書是假的。宋太公思念兒子，騙他回家。宋江在家中被官府捉拿，刺配江州。
花榮|哥哥！花榮不放心，扮作押解的公人，一路陪哥哥去江州！
@quest q5_jiangzhou
@goto jiangzhou start
@end`),
      Q: npc('小嘍囉', 'e_bandit', `嘍囉|（小聲）清風山燕順頭領讓我給宋大哥帶個話：有事儘管開口！`),
    },
    intro: `
花榮|哥哥！你怎麼來了！快，快進寨裡坐！
宋江|賢弟，好久不見！
花榮|聽說哥哥在清風山救了劉高的老婆？那劉高是個貪贓枉法的文官，他老婆更不是好東西……哥哥實在不該救她。
宋江|賢弟差矣。冤仇可解不可結，她畢竟是你同僚的家眷。
@join huarong
@quest q5_lantern`,
  },

  jiangzhou: {
    name: '江州城', ch: 5, bg: 'bg_xunyanglou', bgm: 'town', ground: ':',
    grid: `
##############################
#~~~~~~~~~~~~~~~~~~~~~~~~~~~~#
#~~~~~~~~~~~~~~~~~~~~~~~~~~~~#
#=====R~~~~~~~~~~~~~~~~=====~#
#,,,,,,,,,,,,,,,,,,,,,,,,,2E~#
#,,RRRRRR,,,,,,,,,,,RRRRRR,,,#
#,,RRRRRR,,,,M,,,,,,RRRRRR,,,#
#,,RRR+RR,,,,,,,,,,,RR+RRR,,,#
#,,,,X,,,,,,,,,,,,,,,,,,,,,,,#
#::::::::::::::::::::::::::::#
#,,,,,,,,,,,,:,,,,,,,,,,,,,,,#
#,RRRRRR,,,,,:,,,,,RRRRRRR,,,#
#,RR+RRR,,,G,:,,,,,RRR+RRR,,,#
#,,,D,,,,,,,,:,,,,,,,,B,,,K,,#
#,,,,,,,,,,,,:,,,,,,,,,,,,,,,#
#TT,,,,,,,,,,1,,,,,,,,,,,,,TT#
##############################`,
    marks: {
      '1': entry('start'),
      '2': entry('dock'),
      D: npc('戴宗', 'n_elder', `
@if !flag:dz_meet
戴宗|你就是新來的配軍宋江？好大膽，見了節級也不送常例錢！
宋江|（取出吳用的書信）節級請看。
戴宗|……原來是梁山吳學究的信！小人戴宗，人稱「神行太保」，能日行八百里！哥哥受驚了！
戴宗|江州這地方，有個黑廝叫李逵，力大無窮，脾氣火爆，最是忠心。哥哥要不要見見？他常在魚市那邊鬧事。
@flag dz_meet
@else
戴宗|哥哥在江州，有戴宗照應，放心！
@end`),
      X: npc('李逵', 'p_likui', `
@if !flag:lk_join
李逵|（揮舞雙拳）哪個鳥人敢攔我！我要喝酒！借我十兩銀子！
戴宗|鐵牛！這位便是你日夜念叨的宋江哥哥！
李逵|放屁！宋江哥哥是什麼人物，會在這裡當配軍？你哄我！除非打贏了我，我才信！
花榮|哥哥，這黑廝要試試咱們的本事。
@battle likui bg=bg_xunyanglou
李逵|（爬起來，納頭便拜）哥哥！真是宋江哥哥！鐵牛有眼無珠！哥哥打得好！
宋江|兄弟請起！（取出十兩銀子）拿去用吧。
李逵|哥哥仗義！以後鐵牛這條命，就是哥哥的！
@join likui
@flag lk_join
@else
李逵|哥哥，鐵牛想吃魚了！
@end`, { show: 'flag:dz_meet & !flag:lk_join' }),
      M: npc('魚販', 'n_elder', `
@if quest:s5_market
魚販|多謝好漢除了那幫惡霸！魚市又熱鬧起來了！
@else
魚販|唉，這江州魚市，被一群潑皮把持，每條魚都要抽三成……他們就在東邊碼頭。
@if !qactive:s5_market
@quest s5_market
@end
@end`),
      G: foe('thug@20+thug@20+pirate@19', { name: '魚市惡霸', post: `
魚販|多謝好漢！
@quest s5_market done
@gold 200` }),
      B: npc('江州掌櫃', 'n_waiter', `掌櫃|客官，小店什麼都有！
@choice 買東西|住店（20 兩）|不用了
@if choice:1
@shop jiangzhou
@elif choice:2
@inn 20
@end`),
      K: chest('revive', 2),
      E: exit('river', 'start', '潯陽江', { cond: 'flag:lk_join', deny: '|潯陽江碼頭。', under: ',' }),
    },
    intro: `
|宋江刺配江州。管營、差撥受了宋江的銀子，對他甚是客氣。
|只有那兩院押牢節級，遲遲不見——聽說此人脾氣很大。
@quest q5_jiangzhou done
@quest q5_poem`,
  },

  river: {
    name: '潯陽江', ch: 5, bg: 'bg_river', bgm: 'water', ground: '~', boat: true, anim: true,
    grid: `
##########################
#,,,,,,,,,,RRRRR,,,,,,,,,#
#,,,,,,,,,,RRR+R,,,,,,,,,#
#==========Y=============#
#~~~~~~~~~~~~~~~~~~~~~~~~#
#~~~rrr~~~~~~~~~~rrr~~~~~#
#~~~r~~~~~G~~~~~~~r~~~~~~#
#~~~r~~~~~~~~~~~~~r~K~~~~#
#~~~rrr~~~rrrr~~~rrr~~~~~#
#~~~~~~~~~r~~r~~~~~~~~~~~#
#~~H~~~~~~r~Z~~~~~~~~Q~~~#
#~~~~~~~~~rrrr~~~~~~~~~~~#
#~~~~~~~~~~~~~~~~~~~~~~~~#
#~~~~~~~~~~~1~~~~~~~~~~~~#
#=========E==============#
##########################`,
    marks: {
      '1': entry('start'),
      E: exit('jiangzhou', 'dock', '江州城', { under: '=' }),
      Z: npc('張順', 'p_zhangshun', `
@if !flag:zs_join
張順|哪來的黑廝，在我潯陽江上撒野？上我船來，咱們水裡比劃比劃！
李逵|比就比！鐵牛怕你不成！
|（李逵一跳上船，張順把船一晃，二人一齊翻進江裡！）
花榮|不好，黑旋風不識水性！
@battle zhangshun bg=bg_river
張順|（把李逵撈上船）……你們是什麼人？
戴宗|張二哥，這位是山東及時雨宋公明哥哥！
張順|啊？！宋公明哥哥！小弟張順，人稱「浪裡白條」，久仰大名！今日多有得罪！
李逵|（吐著水）你……你這白條……下次岸上打！
宋江|哈哈，不打不相識！
@join zhangshun
@flag zs_join
@else
張順|哥哥，潯陽江上，張順說了算！
@end`, { show: '!flag:zs_join' }),
      G: foe('pirate@20+pirate@20', { name: '江賊' }),
      Q: foe('pirate@21+pirate@20+archer@20', { name: '江賊' }),
      H: chest('knife3', 1),
      K: chest('wine2', 3),
      Y: trig(`
@if !flag:zs_join
|（江邊一座高樓。先去江上找找那個叫張順的漁霸吧。）
@else
@run xunyang_poem
@end`, { once: false }),
    },
    intro: `
戴宗|哥哥，咱們去江邊吃魚。張順那白條在江上賣魚，他的魚最鮮！
|（潯陽樓就在北岸。）`,
  },

  fachang: {
    name: '江州法場', ch: 5, bg: 'bg_fachang', bgm: 'boss', ground: ':',
    grid: `
############################
#RRRRRRRRRRRRRRRRRRRRRRRRRR#
#RRRRRRRRRRRR+RRRRRRRRRRRRR#
#:::::::::::::::::::::::::E#
#::RRR::::::::::::::::RRR::#
#::RRR::::::_X_:::::::RRR::#
#:::::::::::___:::::::::::#
#::::G::::::::::::::H::::::#
#::::::::::::Y:::::::::::::#
#^^^^^^^:::::::::::::^^^^^^#
#,,,,,,^::::Q:::J::::^,,,,,#
#,,K,,,^:::::::::::::^,,M,,#
#,,,,,,^^^^^^:::^^^^^^,,,,,#
#,,,,,,,,,,,,:::,,,,,,,,,,,#
#,,,,,,,,,,,,,1,,,,,,,,,,,,#
############################`,
    marks: {
      '1': entry('start'),
      X: npc('宋江', 'p_songjiang', `宋江|（被綁在法場上）……兄弟們！`, { show: '!flag:fc_boss', ring: '#fff' }),
      G: foe('soldier@22+soldier@22+archer@21', { name: '官兵' }),
      H: foe('armored@22+soldier@22', { name: '官兵' }),
      Q: foe('armored@21+archer@21', { name: '官兵' }),
      J: foe('soldier@22+archer@22+archer@21', { name: '官兵' }),
      K: chest('elixir', 1),
      M: chest('thunder', 2),
      Y: trig(`
@if !flag:fc_boss
守將|劫法場的反賊！給我殺！
@battle caijiu bg=bg_fachang
|晁蓋親手割斷了宋江身上的繩索。
晁蓋|宋三郎！
宋江|哥哥！你們……你們怎麼來了！
晁蓋|戴院長被捕前派人送信到梁山，我們連夜趕來！
李逵|哥哥！鐵牛一路殺過來，砍翻了上百個鳥兵！
@join songjiang
@flag fc_boss
宋江|江州城門已閉，往北走白龍廟！還有……那黃文炳，在無為軍！
@end`),
      E: exit('fachang', 'start', '無為軍', { cond: 'flag:fc_boss', deny: '|先救下宋江！', script: `
@if !flag:hwb_done
|眾好漢連夜打進無為軍黃文炳家。
黃文炳|你們……你們這些反賊！我乃蔡九知府的座上賓！
宋江|黃文炳！我與你無冤無仇，你為何三番五次害我？
黃文炳|哼，誰叫你寫反詩！我若不揭發，如何升官發財？
@battle huangwenbing bg=bg_fachang
@flag hwb_done
@quest q5_rescue done
@exp 200
@run ch5_end
@end
@end` }),
    },
    intro: `
|七月十五，江州法場。宋江、戴宗被押上刑台，四周圍滿了看熱鬧的百姓。
|午時三刻——
@shake
|「殺！」人群中，扮作耍蛇的、挑擔的、推車的眾好漢一齊發作！一個黑大漢從茶樓上跳下來，掄起兩把板斧——
李逵|哥哥莫慌！鐵牛來也！
晁蓋|梁山泊好漢全伙在此！
@quest q5_rescue`,
  },
};

scripts.qf_lantern = `
@if !flag:qf_caught
|元宵佳節，清風寨裡張燈結綵。宋江獨自在燈下觀看，不由得笑出聲來。
|笑聲驚動了一個人——劉知寨的老婆！
劉高|（他老婆在旁指著宋江）那個黑矮漢子，就是清風山上的賊頭！
宋江|夫人！是宋某救了你的性命啊！
劉高|胡說！給我拿下這個賊！
@battle soldier@18+soldier@18+archer@18 nolose bg=bg_qingfeng
|寡不敵眾，宋江被劉高拿住，打得皮開肉綻，關進了囚車。
@leave huarong
|花榮聞訊大怒，帶著寨兵殺到劉高寨前，搶回了宋江。
@join huarong
@heal
花榮|哥哥！劉高那廝欺人太甚！我已經射開了他的寨門！
宋江|（咬牙）……賢弟，此事不能善了了。
@flag qf_caught
@quest q5_lantern done
@quest q5_liugao
@end`;

scripts.xunyang_poem = `
@if !flag:poem_done
|宋江獨自上了潯陽樓，倚欄眺望江景，不覺酒醉。
宋江|想我宋江，年過三旬，功不成，名不就，倒被文了雙頰，配來這裡……
|宋江乘著酒興，在白粉壁上寫下了一首《西江月》，又添了四句詩——
|「心在山東身在吳，飄蓬江海謾嗟吁。他時若遂凌雲志，敢笑黃巢不丈夫！」
@give k_poem
@flag poem_done
|宋江醉醺醺地回去睡了。不料次日，通判黃文炳來潯陽樓閒坐，看見了這首詩……
黃文炳|「敢笑黃巢不丈夫」？好一首反詩！我去報與蔡九知府，這便是升官的天梯！
|宋江被捕。他裝瘋賣傻，卻被黃文炳識破。戴宗冒險往梁山送信，回來時偽造的回書露了破綻，也被下了獄。
|江州府判二人——斬首示眾。
@quest q5_poem done
@party chaogai,linchong,likui,huarong,zhangshun+
@leave songjiang
@heal
@goto fachang start
@end`;

export default { maps, scripts, quests, chapters };
