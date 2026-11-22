// 第四回：林沖水寨大併火（朱貴酒店、梁山大寨、二龍山、黑風洞、演武場、天下地圖）
import { npc, foe, boss, exit, chest, money, entry, sign, trig, gate, boulder, plate, reset, obj, sw } from './mk.js';

const chapters = {
  4: { title: '林沖水寨大併火', sub: '王倫心胸狹窄，不容晁蓋眾人。林沖怒火中燒——' },
};

const quests = {
  q4_arrow: { name: '響箭', desc: '朱貴放出響箭，喚來接應的船隻，往金沙灘去。' },
  q4_wanglun: { name: '聚義廳', desc: '上山拜見寨主王倫。' },
  q4_erlong: { name: '二龍山三傑', desc: '吳用打聽到二龍山有魯智深、楊志、武松三位好漢。從梁山渡口出發，請他們入夥。' },
  q4_baozhu: { name: '攻打寶珠寺', desc: '二龍山寶珠寺被鄧龍佔據，只有一條山路。打開三道山門，擊敗鄧龍。' },
  s4_cave: { name: '黑風洞', desc: '樵夫說梁山西邊的黑風洞裡藏有前朝寶物，但機關重重。', side: true },
  s4_arena: { name: '演武場', desc: '林沖在大寨演武場設下擂台。擊敗各路高手，可得稀世兵器。', side: true },
  s4_drill: { name: '山寨操練', desc: '杜遷請頭領們下場，指點大寨裡三隊演練的嘍囉。', side: true },
  s4_lew: { name: '蓼兒洼水寨', desc: '蓼兒洼藏著官府水軍。轉動水門絞盤，擊敗水軍統制。', side: true },
  s4_snake: { name: '洞中白蟒', desc: '二龍山後洞有一條白蟒傷人。', side: true },
};

const scripts = {
  drill_chk: `
@if flag:k:liangshan:7,2 & flag:k:liangshan:23,2 & flag:k:liangshan:20,11 & !flag:drill3
@flag drill3
|三隊嘍囉都操練完了。回去告訴杜遷吧。
@end`,
  ch4_start: `
@chapter 4
@heal
@goto zhugui start`,
  ch4_end: `
@if !flag:ch4_done
@flag ch4_done
晁蓋|眾位兄弟！自今日起，梁山泊二十條好漢在此聚義！
魯智深|哈哈哈！林兄弟，灑家說過，要和你在梁山喝個痛快！
林沖|師兄！
武松|晁天王，武松願效犬馬之勞！
楊志|楊志失了生辰綱，無處可去。今日能與諸位英雄共事，三生有幸！
吳用|哥哥，梁山日漸興旺。只是……小生聽說，鄆城的宋押司出事了。
晁蓋|宋三郎？！當初若不是他冒死報信，我們七人早已身首異處！快說，他怎麼了？
吳用|宋押司殺了閻婆惜，逃往清風寨投奔花榮去了……
晁蓋|派人去打聽！若宋三郎有難，梁山眾兄弟赴湯蹈火，也要救他！
@quest q4_erlong done
@title 第四回・終/梁山聚義/梁山泊日漸興旺。而另一位好漢——及時雨宋江的命運，正在風雨飄搖之中。
@run ch5_start
@end`,
};

const maps = {
  zhugui: {
    name: '朱貴酒店', ch: 4, bg: 'bg_tavern', bgm: 'town', ground: '_',
    grid: `
################
#RRRRRRRRRRRRRR#
#RRRRRR+RRRRRRR#
#______________#
#__A______K____#
#______________#
#__B_____C_____#
#______________#
#,,,,,,1,,,,,,,#
#~~~~==E==~~~~~#
################`,
    marks: {
      '1': entry('start'),
      A: npc('朱貴', 'n_waiter', `
@if !flag:zg_arrow
朱貴|諸位好漢從何處來？……原來是東溪村晁保正！久仰大名！
朱貴|小人朱貴，人稱「旱地忽律」，是梁山泊王頭領派在此處打探消息的。
朱貴|寨中林沖林教頭，也時常提起柴大官人的書信……他說梁山正需要真好漢。
@choice 請朱頭領引見|先在店裡休息一下
@if choice:1
朱貴|好！（取出一張鵲畫弓，搭上一支響箭，望對港蘆葦中射去）
@sfx gong
|響箭到處，早見蘆葦裡幾個小嘍囉搖出一隻快船來。
@give k_arrow
@flag zg_arrow
@quest q4_arrow
@else
@inn 0
@end
@else
朱貴|船已經在碼頭等著了，諸位請上船吧。
@end`),
      B: npc('酒保', 'n_waiter', `酒保|客官要買些什麼？
@shop dongxi`),
      C: npc('劉唐', 'p_liutang', `劉唐|這梁山泊真是好去處！八百里水泊，易守難攻！`),
      K: chest('elixir', 1),
      E: exit('liangshan', 'start', '金沙灘', { cond: 'flag:zg_arrow', deny: '|碼頭邊沒有船。先跟朱貴說話。', under: '=' }),
    },
  },

  liangshan: {
    name: '梁山泊大寨', ch: 4, bg: 'bg_mountainfort', bgm: 'hall', ground: ',',
    grid: `
##############################
#^^^^^^^^^^RRRRRRRR^^^^^^^^^^#
#^^TT,,X,,,RRRRRRRR,,,,YTT^^^#
#^T,,,,,,,,RRR+RRRR,,,,,,,T^^#
#^,,,,,,,,,,,,J,,,,,,,,,,,,,^#
#^,,RRRR,,,,::2::,,,,,RRRR,,^#
#^,,RR+R,,,,:,,,:,,,,,R+RR,,^#
#^,,,A,,,,,,:,L,:,,,,,,B,,,,^#
#^,,,,,,,U,,:,,,:,,,,,,,P,,,^#
#^^,,,,,,,,,:::::,,,,,,,,,,^^#
#^^^,,,K,,,,,,:,,,,,,,,G,,^^^#
#^^^^,,,,,,,,,:,,,,,V,,,,^^^^#
#^^^^^,,,,,,,,:,,,,,,,,,^^^^^#
#^~~~~~~~,,,,,:,,,W,~~~~~~~~^#
#^~~~~~~~,,,H,:,,,,,~~~~~~~~^#
#^~~~~~~~~,,,,1,,,,~~~~~~~~~^#
#~~~~~~~~~~~~=D=~~~~~~~~~~~~~#
##############################`,
    marks: {
      '1': entry('start'),
      '2': entry('hall'),
      J: exit('juyiting', 'start', '聚義廳'),
      L: npc('林沖', 'p_linchong', `
@if !flag:wl_done
林沖|（獨自站在斷金亭邊）……你們是東溪村的好漢？我是林沖。
林沖|王倫寨主心胸狹窄，容不得比他強的人。我上山時，他也百般刁難，要我納「投名狀」……
林沖|諸位上了聚義廳，且看他怎麼說。若他不仁……林沖自有主張。
@flag lin_met
@end`, { show: '!flag:wl_done' }),
      A: npc('吳用', 'p_wuyong', `
@if flag:ch4_done
吳用|哥哥們，梁山在此，進可攻、退可守。缺什麼兵器藥品，後勤都有。
@elif flag:wl_done & !flag:erlong_done
吳用|二龍山的魯智深、楊志、武松三位都是當世好漢，若能請上山來，梁山如虎添翼。從南邊渡口搭船去吧。
@if !qactive:q4_erlong
@quest q4_erlong
@end
@elif flag:erlong_done
吳用|二龍山的好漢都已上山！快去聚義廳見晁天王吧。
@else
吳用|這梁山……王倫守不住的。
@end`, { show: 'flag:wl_done' }),
      B: npc('後勤頭領', 'n_waiter', `
@if flag:wl_done
朱貴|山寨的兵器、藥品都在這裡。要什麼儘管拿——當然，也得給些銀子充作軍餉。
@choice 藥品・兵器|軍械庫（精良兵器）|不用了
@if choice:1
@shop liangshan
@elif choice:2 & ch:5
@shop liangshan2
@elif choice:2
朱貴|軍械庫還在打造，過些日子再來。
@end
@else
嘍囉|這是王頭領的庫房，閒人免進！
@end`),
      H: npc('樵夫', 'n_elder', `
@if !flag:wl_done
樵夫|山上換了主人，日子就好過了……
@else
樵夫|頭領，這梁山泊往西，有座黑風洞，聽說藏著前朝的寶物，可是進去的人都出不來……
樵夫|洞裡有機關，要把大石頭推到石台上才能打開。
@if !qactive:s4_cave & !quest:s4_cave
@quest s4_cave
@flag s4_cave_known
@end
@end`),
      K: chest('pill', 2),
      X: foe('bandit@16+bandit@16', { name: '演練嘍囉', show: 'flag:wl_done', post: `@run drill_chk` }),
      Y: foe('armored@17+bandit@16', { name: '演練嘍囉', show: 'flag:wl_done', post: `@run drill_chk` }),
      V: foe('archer@17+archer@17+bandit@16', { name: '演練嘍囉', show: 'flag:wl_done', post: `@run drill_chk` }),
      U: npc('杜遷', 'e_bandit', `
@if !flag:wl_done
杜遷|新來的？規矩點，這是王頭領的山寨。
@elif quest:s4_drill
杜遷|頭領們親自下場操練，嘍囉們都長進了！
@elif flag:drill3
杜遷|三隊嘍囉都被頭領們打服了！這是山寨庫房裡的好東西，請收下！
@give jade
@gold 300
@quest s4_drill done
@else
杜遷|晁天王上山後，嘍囉們要重新操練。頭領們能不能下場指點一番？大寨裡有三隊嘍囉在演練。
@if !qactive:s4_drill
@quest s4_drill
@end
@end`, { tint: 'sepia(.5) hue-rotate(200deg) saturate(1.8)' }),
      P: npc('公孫勝', 'p_gongsunsheng', `
@if flag:wl_done
公孫勝|貧道夜觀天象，見罡星一百零八顆，聚於梁山之上。
公孫勝|如今才聚了十餘位，往後的路還長著呢。
公孫勝|頭領若遇強敵，不妨多備些藥材與好兵器。後勤那裡都有。
@else
公孫勝|這王倫……貧道看他氣數已盡。
@end`, { show: 'flag:wl_done' }),
      W: npc('阮小五', 'p_ruanxiaoqi', `
@if !flag:wl_done
阮小五|……
@elif quest:s4_lew
阮小五|蓼兒洼清淨了！咱們梁山的水寨，再也不怕官兵偷襲！
@elif flag:lew_done
阮小五|好！官軍水寨被端了！這是從他們船上繳來的寶貝！
@give bow3
@quest s4_lew done
@else
阮小五|我是阮小七的五哥阮小五。頭領，梁山西南的蓼兒洼裡，藏著一支官府水軍，常常偷襲咱們的漁船。
阮小五|那裡水門重重，要轉動水門絞盤才能過去。從渡口搭船，在天下地圖上找「蓼兒洼」。
@if !qactive:s4_lew
@quest s4_lew
@flag lew_known
@end
@end`, { tint: 'hue-rotate(20deg) saturate(1.2)', show: 'flag:wl_done' }),
      G: exit('yanwu', 'start', '演武場', { cond: 'flag:wl_done', deny: '嘍囉|演武場，王頭領吩咐了不許外人進！' }),
      D: exit('tianxia', 'liangshan', '渡口', { cond: 'flag:wl_done', deny: '|渡口。現在還不是離開的時候。', under: '=' }),
    },
    intro: `
|晁蓋等人在金沙灘上了岸。只見山勢雄奇，關隘重重，四面八百里水泊環繞。
@quest q4_arrow done
@quest q4_wanglun`,
  },

  juyiting: {
    name: '聚義廳', ch: 4, bg: 'bg_juyiting', bgm: 'hall', ground: '_',
    grid: `
################
#RRRRRRRRRRRRRR#
#_____W__S_____#
#____H____M____#
#_A__________B_#
#____Q____L____#
#_C__________D_#
#______________#
#_____Y__Y_____#
#______1_______#
#######_E#######
################`,
    marks: {
      '1': entry('start'),
      W: npc('王倫', 'b_wanglun', `@run wanglun`, { show: '!flag:wl_done', ring: '#c33' }),
      Y: trig(`@run wanglun`, { cond: '!flag:wl_done' }),
      S: npc('晁蓋', 'p_chaogai', `
@if flag:erlong_done & !flag:ch4_done
@run ch4_end
@elif flag:ch6_done
晁蓋|宋三郎，梁山有今日，全賴眾兄弟同心！
@elif flag:ch4_done
晁蓋|兄弟們辛苦了。休息一下，養足精神！
@inn 0
@else
晁蓋|梁山泊——從今以後，「替天行道」！
@end`, { show: 'flag:wl_done' }),
      A: npc('杜遷', 'e_bandit', `
@if flag:wl_done
杜遷|晁天王仁義，我杜遷心服口服。
@else
杜遷|王頭領……今天臉色不好啊。
@end`, { tint: 'sepia(.5) hue-rotate(200deg) saturate(1.8)' }),
      B: npc('宋萬', 'e_thug', `
@if flag:wl_done
宋萬|以後跟著晁天王，有酒同喝，有肉同吃！
@else
宋萬|嘿嘿……
@end`, { tint: 'sepia(.5) hue-rotate(100deg) saturate(1.8)' }),
      C: npc('公孫勝', 'p_gongsunsheng', `公孫勝|貧道觀這梁山風水，乃是天罡地煞聚會之所。`, { show: 'flag:wl_done' }),
      D: npc('阮小七', 'p_ruanxiaoqi', `
@if flag:wl_done
阮小七|哈哈！以後這八百里水泊，咱們想怎麼打魚就怎麼打魚！
@else
阮小七|這姓王的看人的眼神，我不喜歡。
@end`),
      E: exit('liangshan', 'hall', '大寨'),
      H: npc('林沖', 'p_linchong', `
@if flag:ch6_done
林沖|娘子……若你在天有靈，看到林沖今日與眾兄弟替天行道，也該欣慰了。
@elif flag:ch5_done
林沖|祝家莊揚言要踏平梁山，哼。宋大哥一聲令下，林沖第一個打頭陣！
@else
林沖|師兄來了，武松、楊志也來了……梁山越來越熱鬧了。
林沖|我常常想起東京的娘子。聽說高衙內逼她改嫁，她……自縊了。
林沖|高俅……總有一天，林沖要親手討回這筆血債。
@end`, { show: 'flag:ch4_done' }),
      M: npc('魯智深', 'p_luzhishen', `
@if flag:ch5_done
魯智深|那黑旋風李逵，酒量倒和灑家差不多！哈哈哈！
@else
魯智深|灑家在五台山出家時，最受不了的就是不許喝酒！還是梁山好！
魯智深|你知道灑家為什麼叫「花和尚」？因為背上刺了一身花繡！
@end`, { show: 'flag:ch4_done' }),
      Q: npc('宋江', 'p_songjiang', `
@if flag:ch6_done
宋江|兄弟們，梁山泊的大旗上寫著「替天行道」。我們要記得：為的是天下受苦的百姓。
@elif flag:ch5_done
宋江|吳用軍師說，獨龍岡的祝家莊辱罵梁山，揚言要捉盡梁山好漢。
宋江|我們從渡口出發，往南方的祝家店打探吧。只是……不可傷了無辜百姓。
@end`, { show: 'flag:ch5_done' }),
      L: npc('李逵', 'p_likui', `
@if flag:ch6_done
李逵|祝家莊打完了！下一個打誰？鐵牛的板斧都等不及了！
@else
李逵|哥哥！鐵牛想下山！鐵牛想打仗！
宋江|（遠遠地）鐵牛！不許胡鬧！
李逵|……是，哥哥。（小聲）鐵牛就說說嘛。
@end`, { show: 'flag:ch5_done' }),
    },
  },

  tianxia: {
    name: '天下', ch: 4, image: 'bg_worldmap', bgm: 'field', ground: '.',
    grid: `
########################
#                      #
#                 B    #
#   C.....        .    #
#        .   L    .    #
#        ....A.....    #
#            S    .    #
#            .    .    #
#            .    W    #
#            .         #
#            Z         #
#                      #
########################`,
    marks: {
      liangshan: null,
      A: entry('liangshan'),
      S: entry('start'),
      W: exit('liaoerwa', 'start', '蓼兒洼', { cond: 'flag:lew_known' }),
      L: exit('liangshan', 'start', '梁山泊'),
      B: exit('erlongshan', 'start', '二龍山', { cond: 'flag:wl_done' }),
      C: exit('cave', 'start', '黑風洞', { cond: 'qactive:s4_cave | quest:s4_cave' }),
      Z: exit('zhudian', 'start', '祝家店', { cond: 'ch:6', deny: '|往南是獨龍岡，祝家莊的地界。現在還不是時候。' }),
    },
  },
};

// 梁山入口：天下地圖上的「梁山泊」節點緊鄰出生點
delete maps.tianxia.marks.liangshan;
maps.tianxia.marks.C.cond = 'flag:s4_cave_known';

scripts.wanglun = `
@if !flag:wl_done
|聚義廳上，王倫設宴款待晁蓋等人。酒過數巡，王倫叫小嘍囉捧出一個大盤子，裡面放著五錠大銀。
王倫|感蒙眾豪傑到此聚義，只恨敝山小寨是一窪之水，如何安得許多真龍？聊備些小薄禮，萬望笑留，煩投大寨歇馬。
晁蓋|……小子久聞大山招賢納士，一徑地特來投託入夥。若是不能相容，我等眾人自行告退。
王倫|非是敝山不納眾位豪傑，奈緣只為糧少房稀，恐日後誤了足下，眾位面皮不好看。
@shake
|只見林沖雙眉剔起，兩眼圓睜，坐在交椅上大喝道——
林沖|你前番我上山來時，也推道糧少房稀！今日晁兄與眾豪傑到此山寨，你又發出這等言語來，是何道理！
王倫|你看這畜生！又不醉了，倒把言語來傷觸我，卻不是反失上下！
林沖|量你是個落第腐儒，胸中又沒文學，怎做得山寨之主！
王倫|杜遷、宋萬！給我拿下這廝！
吳用|（暗中撚鬚）……時候到了。
@party linchong,chaogai,wuyong,gongsunsheng+
@battle duqian+songwan bg=bg_juyiting
杜遷|林教頭息怒！我們……我們也不服王倫很久了！
王倫|你們……你們都反了！
@battle wanglun bg=bg_juyiting
|林沖拿住王倫，罵道：「你是一個村野窮儒，虧了杜遷得到這裡。柴大官人這等資助你，周給盤纏，與你相交，舉薦我來，尚且許多推卻。今日眾豪傑特來相聚，又要發付他下山去。這梁山泊便是你的？你這嫉賢妒能的賊，不殺了要你何用！」
|林沖火併了王倫。
林沖|（扶晁蓋坐上第一把交椅）晁兄仗義疏財，智勇足備，方今天下，人聞其名無有不伏。我今日以義氣為重，立他為山寨之主，好麼？
杜遷|願依頭領言語！
晁蓋|……不可！林教頭，你武藝蓋世——
林沖|哥哥休要推辭！
|眾人推晁蓋坐了第一位，吳用第二位，公孫勝第三位，林沖第四位。梁山泊從此換了新天地。
@flag wl_done
@quest q4_wanglun done
@exp 120
@heal
吳用|哥哥，小生打聽到，二龍山有三位好漢……
@quest q4_erlong
@end`;

maps.erlongshan = {
  name: '二龍山・寶珠寺', ch: 4, bg: 'bg_mountainfort', bgm: 'dungeon', ground: '.',
  grid: `
##############################
#^^^^^^^^^^RRRRRRRR^^^^^^^^^^#
#^^^,,,,^^^RRR+RRRR^^^,,,,X^^#
#^^,,P,,^^^,,,Y,,,,^^^,,,,,^^#
#^^,,,,,,,,,,,,,,,,,,,,,,G,^^#
#^^^^^^^^^^^^^3^^^^^^^^^^^^^^#
#^^,,,,,,^^^,,,,,^^^,,,,,,,^^#
#^^,,K,,,,,,,,,,,,,,,,,,,,,^^#
#^^,,,,,,^^^,,H,,^^^,,Q,,,,^^#
#^^^^^^^^^^^^^2^^^^^^^^^^^^^^#
#^^,,,,,,,,,,,,,,,,,,,,,,,,^^#
#^^,O,,,,,^^^,,,,,^^^,,,,M,^^#
#^^,,,,,,,^^^,,J,,^^^,,,,,,^^#
#^^^^^^^^^^^^^4^^^^^^^^^^^^^^#
#^^^,,,,,,,,,,,,,,,,,,,,,^^^^#
#^^^,,A,,,,,,,,,,,,,,B,,,^^^^#
#^^^^,,,,,,,,,,,,,,,,,,,^^^^^#
#^^^^^^^^^^^^1E^^^^^^^^^^^^^^#
##############################`,
  marks: {
    '1': entry('start'),
    E: exit('tianxia', 'liangshan', '下山'),
    A: npc('魯智深', 'p_luzhishen', `
@if !flag:el_meet
魯智深|兀那漢子——咦？！林兄弟！是林兄弟嗎？！
林沖|師兄！！
魯智深|哈哈哈哈！灑家聽說你火燒草料場、殺了陸謙，痛快！痛快！
林沖|師兄怎麼在這裡？
魯智深|灑家在東京待不住了，一路流浪到此。這二龍山寶珠寺被鄧龍那廝佔了，他閉了三道關門，灑家打不進去！
楊志|（走過來）在下楊志。黃泥岡上失了生辰綱……原來就是諸位好漢劫的。
晁蓋|楊制使，得罪了。
楊志|罷了，那是不義之財。如今我和魯大師在此，正想奪下寶珠寺安身。
武松|（大步走來）好熱鬧！灑家……不，貧道行者武松，也來湊個數！
孫二娘|老娘也來了！張青說二龍山要打仗，叫我來幫忙！
魯智深|好！今天咱們一起打上山去！
吳用|這山路只有一條，三道關門由機關控制。各關門旁有絞盤，打倒守衛，轉動絞盤便能開門。
@join luzhishen
@join yangzhi
@join wusong
@if hero:sunerniang
@join sunerniang
@end
@flag el_meet
@quest q4_baozhu
魯智深|看灑家的！（一禪杖砸在第一道關門上）
@shake
|第一道關門被魯智深硬生生砸開了！
@else
魯智深|兄弟，打上山去！
@end`, { show: '!flag:el_meet' }),
    B: npc('曹正', 'n_waiter', `
曹正|小人曹正，是林教頭的徒弟！在山下開酒店。師父要什麼，只管說！
@choice 休息（免費）|買東西|不用了
@if choice:1
@inn 0
@elif choice:2
@shop jiangzhou
@end`),
    J: foe('bandit@17+bandit@17+archer@16', { name: '嘍囉' }),
    O: sw('el_gate2', `|絞盤嘎吱嘎吱轉動，遠處第二道關門升起來了！`),
    M: chest('herb', 4),
    '4': gate('flag:el_meet', '|第一道關門緊閉，門板厚實。山腳下好像有人在。'),
    H: foe('armored@17+bandit@17', { name: '守關嘍囉' }),
    K: sw('el_gate3', `|絞盤轉動，第三道關門升起來了！寶珠寺就在眼前！`),
    Q: foe('leopard@17+leopard@17', { name: '山豹' }),
    '2': gate('flag:el_gate2', '|第二道關門緊閉。'),
    P: chest('saber3', 1),
    G: foe('bandit@18+armored@17+archer@17', { name: '守關嘍囉' }),
    '3': gate('flag:el_gate3', '|第三道關門緊閉。'),
    X: trig(`
@if !flag:snake_done
|後山一個陰冷的山洞，洞口散落著白骨。
@if !qactive:s4_snake
@quest s4_snake
@end
@battle cavebeast bg=bg_cave
|白蟒被斬殺了。洞中留著前人遺下的寶物。
@flag snake_done
@quest s4_snake done
@give golden
@end`, { visible: true, name: '後洞' }),
    Y: trig(`
@if !flag:erlong_done
鄧龍|哪裡來的鳥人，敢闖我寶珠寺！
魯智深|鄧龍！灑家今天要你的命！
@battle denglong bg=bg_mountainfort
|眾好漢奪下了二龍山寶珠寺。
魯智深|林兄弟，灑家們跟你上梁山！這二龍山就交給曹正打理！
楊志|楊志願隨諸位，替天行道！
武松|梁山泊——好！
@flag erlong_done
@quest q4_baozhu done
@exp 150
@party chaogai,linchong,luzhishen,wusong+
吳用|回梁山聚義廳見晁天王吧！
@end`),
  },
  intro: `
|二龍山。山勢陡峭，一條羊腸小道直通山頂的寶珠寺。`,
};

maps.liaoerwa = {
  name: '蓼兒洼', ch: 4, bg: 'bg_marsh', battleBg: 'bg_river', bgm: 'water', ground: '~', boat: true, anim: true,
  grid: `
##########################
#rrrrrrrrrrrrrrrrrrrrrrrr#
#r~~~~~~~r~~~~~~~~r~~~~~r#
#r~~G~~~~r~~~H~~~~r~~Q~~r#
#r~~~~~~~r~rrrr~~~r~~~~~r#
#r~a~~~~~2~~~~r~b~3~~~~~r#
#r~~~~~~~r~~~~r~~~r~~Z~~r#
#rrr~~rrrr~~K~r~~~r~~~~~r#
#r~~~~~~~r~~~~~~~~r~~~M~r#
#r~~J~~~~r~~~~V~~~rrrr~~r#
#r~~~~~~~rrrrrrrrrr~~~~~r#
#r~E1~~~~r~~~~~~~~r~~~~~r#
#rrrrrrrrrrrrrrrrrrrrrrrr#
##########################`,
  marks: {
    '1': entry('start'),
    E: exit('tianxia', 'liangshan', '回航'),
    a: sw('lew_g1', `|嘎吱嘎吱——第一道水門緩緩升起！`, { name: '水門絞盤' }),
    b: sw('lew_g2', `|第二道水門升起來了！水軍大營就在裡面！`, { name: '水門絞盤' }),
    '2': gate('flag:lew_g1', '|一道木柵水門擋住了水路。'),
    '3': gate('flag:lew_g2', '|又一道水門。'),
    G: foe('pirate@19+pirate@19', { name: '水軍哨船' }),
    J: foe('archer@19+pirate@19', { name: '水軍哨船' }),
    H: foe('soldier@20+archer@20+pirate@19', { name: '水軍' }),
    V: foe('armored@20+archer@20', { name: '水軍' }),
    Q: foe('pirate@21+pirate@21+archer@20', { name: '水軍' }),
    Z: foe('armored@22+archer@22+archer@21', { name: '水軍統制', noEscape: true, post: `
|官府水軍的統制被打落水中，狼狽逃走。
@flag lew_done
阮小七|哈哈！這蓼兒洼以後就是咱們梁山的後花園了！回去告訴五哥！` }),
    K: chest('pill', 2),
    M: chest('armor4', 1),
  },
  intro: `
|蓼兒洼。港汊縱橫，蘆葦叢生。遠處隱約可見官軍的旗號。
|（轉動水門絞盤打開水門。）`,
};

maps.cave = {
  name: '黑風洞', ch: 4, bg: 'bg_cave', bgm: 'dungeon', ground: ':', night: 'rgba(10,10,30,.45)',
  grid: `
##########################
#^^^^^^^^^^^^^^^^^^^^^^^^#
#^K,,^:::::::::::::^,,M,^#
#^,G,^::^^^^^^^^^::^,H,,^#
#^^^D^::^:::::::^::^^D^^^#
#^:::::::::B::B::::::::^#
#^::^^^^:::::::::^^^^:::^#
#^::^Q:^::P:::P::^:J^:::^#
#^::^::^:::::::::^::^:::^#
#^:::::::::::::::O:::::^#
#^^^^^^^^^^^1^^^^^^^^^^^^#
#^^^^^^^^^^^E^^^^^^^^^^^^#
##########################`,
  marks: {
    '1': entry('start'),
    E: exit('tianxia', 'liangshan', '出洞'),
    B: boulder(),
    P: plate(),
    O: reset(),
    D: gate('flag:solved:cave', '|石門緊閉，門上刻著兩個石台的圖樣。'),
    K: chest('banner', 1),
    M: chest('golden', 1),
    G: foe('snake@19+snake@19+leopard@18', { name: '洞中毒蛇' }),
    H: foe('leopard@19+leopard@19', { name: '黑豹' }),
    Q: foe('wolf@19+wolf@19+wolf@19', { name: '狼群' }),
    J: chest('elixir', 2),
  },
  intro: `
|黑風洞。陰風颼颼，伸手不見五指。洞中央有兩座石台，左右兩扇石門緊閉。
|【謎題】把兩塊大石頭分別推到兩座石台上。推錯了可以調查「重擺石頭」。`,
  onSolve: `
|兩塊大石頭落在石台上，轟隆一聲——左右兩扇石門同時打開了！
@quest s4_cave done`,
};

maps.yanwu = {
  name: '演武場', ch: 4, bg: 'bg_yanwu', bgm: 'battle', ground: 's',
  grid: `
######################
#RRRRRRRRRRRRRRRRRRRR#
#RRRRRRRR+RRRRRRRRRRR#
#ssssssssssssssssssss#
#ss,A,,,,,,,,,,,,,,ss#
#ss,,,,,,,,,,,,,,,,ss#
#ss,,B,,,C,,,D,,,Q,ss#
#ss,,,,,,,,,,,,,,,,ss#
#ss,,,,,,,,G,,,,,,,ss#
#ss,,,,,,,,,,,,,,,,ss#
#ssssssssss1sssssssss#
##########E###########
######################`,
  marks: {
    '1': entry('start'),
    E: exit('liangshan', 'start', '大寨'),
    A: npc('林沖', 'p_linchong', `
林沖|這演武場，是給兄弟們練武的地方。我請來幾位高手設擂，打贏了，便有稀世兵器相贈。
林沖|擂台由易到難：洪教頭、白額虎王、蔣門神、鐵甲將軍，最後是「天罡試煉」。量力而行！
@if !qactive:s4_arena & !quest:s4_arena
@quest s4_arena
@end
@if flag:ar5
林沖|五場擂台全勝！兄弟們的武藝，已是天下無雙！
@quest s4_arena done
@end`),
    B: boss('ar_hong', '擂台一・洪教頭 Lv26', { arena: true, noEscape: false, post: `@flag ar1` }),
    C: boss('ar_tiger', '擂台二・虎王 Lv30', { arena: true, noEscape: false, show: 'flag:ar1', post: `@flag ar2` }),
    D: boss('ar_jiang', '擂台三・蔣門神 Lv32', { arena: true, noEscape: false, show: 'flag:ar2', post: `@flag ar3` }),
    Q: boss('ar_iron', '擂台四・鐵甲 Lv34', { arena: true, noEscape: false, show: 'flag:ar3', post: `@flag ar4` }),
    G: boss('ar_luan', '天罡試煉 Lv38', { arena: true, noEscape: false, show: 'flag:ar4 & flag:ch6_done', post: `@flag ar5
林沖|好！好！天下第一！` }),
  },
};

export default { maps, scripts, quests, chapters };
