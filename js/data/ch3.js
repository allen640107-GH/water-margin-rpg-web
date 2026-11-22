// 第三回：吳用智取生辰綱（東溪村、石碣村、黃泥岡、梁山泊）
import { npc, foe, boss, exit, chest, money, entry, sign, trig, gate, boulder, plate, reset, obj, sw } from './mk.js';

const chapters = {
  3: { title: '吳用智取生辰綱', sub: '梁中書搜刮十萬貫金珠，為岳父蔡京賀壽。七條好漢，劫的是不義之財。' },
};

const quests = {
  q3_liutang: { name: '赤髮鬼', desc: '雷橫在靈官殿捉了個大漢，送到晁蓋莊上。' },
  q3_leiheng: { name: '追討銀兩', desc: '劉唐不服氣，要去追雷橫討回銀子。到村東口攔住雷橫。' },
  q3_ruan: { name: '說三阮撞籌', desc: '吳用要去石碣村，請阮氏兄弟入夥。乘船找到阮小七。' },
  q3_gang: { name: '黃泥岡', desc: '扮作販棗客商，在黃泥岡等候楊志的押運隊伍。' },
  q3_flee: { name: '投奔梁山', desc: '事情敗露，官兵追來！穿過蘆葦蕩，到梁山泊邊的朱貴酒店。' },
  s3_xixi: { name: '西溪村的強人', desc: '一夥強人在東溪村東邊搶掠，替西溪村民趕走他們。', side: true },
  s3_fish: { name: '金色鯉魚', desc: '阮小七的老娘病了，想吃一尾金色鯉魚。在石碣村水面上找找。', side: true },
};

const scripts = {
  xixi_chk: `
@if flag:k:dongxi:23,11 & flag:k:dongxi:26,11 & !flag:xixi_done
@flag xixi_done
|強人都被打跑了。回去告訴西溪村民吧。
@end`,
  ch3_start: `
@chapter 3
@party chaogai
@heal
@cg bg_village
|山東濟州鄆城縣東溪村，有個保正，姓晁名蓋。祖是本縣本鄉富戶，平生仗義疏財，專愛結識天下好漢。
|鄰村西溪村有座青石寶塔鎮鬼，晁蓋大怒，獨自奪了青石寶塔，移在東溪村來——人稱「托塔天王」。
@cg off
@goto dongxi start`,
  fish_spot: `
@if flag:s3_fish_got
|（水面上漣漪點點。）
@elif qactive:s3_fish
|水面下一道金光閃過！
@choice 撒網|算了
@if choice:1
@battle pirate@14+snake@14 bg=bg_river
|網裡一尾金燦燦的大鯉魚！
@give k_fish
@flag s3_fish_got
@end
@else
|水面下好像有什麼東西在發光……
@end`,
};

const maps = {
  dongxi: {
    name: '東溪村', ch: 3, bg: 'bg_village', bgm: 'town', ground: ',',
    grid: `
############################
#TT,,,,,,,,,,,,,,,,,,,,,,TT#
#T,,RRRRRRRR,,,,,,RRRRRR,,T#
#,,,RRRRRRRR,,,,,,RRRRRR,,,#
#,,,RRRR+RRR,,,,,,RR+RRR,,,#
#,,,,,,A,,,,,,,,,,,,W,,,,,,#
#,,,,,,,,,,,,::::,,,,,,,,,,#
#::::::::::::::::::::::::::#
#,,,,,,,,:,,,,,,,,,,:,,,,,,#
#,K,,X,,,:,,,,,,,,,,:,,,TT,#
#,,,,,,,,:,,RRRRR,,,:,,,,,,#
#,,TT,,,,:,,RR+RR,,,:,,G,,P#
#,,,,,,,,:,,,,M,,,,,:,,,,,,#
#TT,,,,,,:,,,,,,,,,,:,,,,,,#
#,,,,,H,,::::::::::::::::::#
#,,,,,,,,,,,,,,,,,,,,,,,,,Y#
#TT,,,,,J,,,,,,,,,,,,,,,,,E#
#TTTT,,,,Q,,,,1,,,,,,,,,,TT#
############################`,
    marks: {
      '1': entry('start'),
      A: npc('晁蓋莊', 'p_chaogai', `
@if !flag:gs_join & flag:wy_join
|一個道士在莊門前與莊客爭執，要見晁保正。
公孫勝|貧道公孫勝，薊州人氏，人稱「入雲龍」。有一套富貴，特來投奔保正！
晁蓋|（屏退左右）先生請講。
公孫勝|北京大名府梁中書，收買十萬貫金珠寶貝，送上東京與他丈人蔡太師慶生辰——此一套是不義之財，取而何礙？
吳用|（從屏風後轉出）好！這便是「七星聚義」——先生，劉唐兄弟也是為此事而來！
晁蓋|我昨夜夢見北斗七星直墜在我屋脊上，原來應在此處！
吳用|如今只差三人。石碣村有阮氏三兄弟，水上本領了得，小生去說他們入夥。
@join gongsunsheng
@flag gs_join
@quest q3_ruan
@elif flag:gs_join
吳用|保正，小生已安排妥當，咱們往村南碼頭搭船去石碣村。
@else
莊客|保正在莊裡等著呢。
@end`, { show: 'flag:lt_join' }),
      W: npc('吳用', 'p_wuyong', `
@if !flag:lt_join
吳用|小生吳用，在這村裡教幾個學生。保正家今早好熱鬧啊。
@elif !flag:wy_join
吳用|（搖著羽扇）二位且住手！聽小生一言。
@else
吳用|保正，莊上似乎有客人來了。
@end`, { show: '!flag:wy_join' }),
      Y: trig(`
@if flag:lt_join & !flag:lh_done
|劉唐提著朴刀追上了雷橫。
劉唐|兀那都頭，不要走！還我銀子來！
雷橫|那是你阿舅送我的，干你甚事！你這廝夜裡睡在靈官殿，必不是好人！
劉唐|你誣良為盜，詐了我阿舅的銀子！看刀！
晁蓋|劉唐休得無禮！……也罷，雷都頭，得罪了！
@battle leiheng bg=bg_village
|雷橫抵擋不住，正在危急——只見一個秀才模樣的人，手提兩條銅鏈，從柴門裡出來，往中間一隔。
吳用|你兩個好漢且不要鬥。我看了多時，權且歇一歇，我有話說。
吳用|雷都頭，看小生薄面，此事就此作罷如何？
雷橫|（看了看晁蓋）……罷了，教授說和，雷橫就給保正這個面子。
|雷橫帶著土兵走了。
晁蓋|教授來得正好！此事須得教授定奪。
吳用|保正，這位劉兄所謀何事，小生已猜到七八分……咱們回莊上細說。
@join wuyong
@flag lh_done
@flag wy_join
@quest q3_leiheng done
@end`, { once: false }),
      X: sign('|「托塔天王」從西溪村奪來的青石寶塔。據說重有千斤。', { glyph: '塔' }),
      M: npc('貨郎', 'n_waiter', `貨郎|保正，我這裡什麼都有！
@shop dongxi`),
      H: npc('莊客', 'e_militia', `
@if !flag:lt_join
莊客|雷都頭帶著土兵往莊上來了，說是在靈官殿捉了個賊。
@else
莊客|保正仗義，咱們東溪村的人都服他。
@end`),
      J: npc('村婦', 'n_woman', `村婦|晁保正好人哪，去年荒年，他開倉放糧，救了全村的命。`),
      G: foe('bandit@13+bandit@12', { name: '強人', post: `@run xixi_chk` }),
      P: foe('bandit@13+wolf@13', { name: '強人', post: `@run xixi_chk` }),
      Q: npc('西溪村民', 'n_elder', `
@if quest:s3_xixi
村民|托塔天王的大恩，西溪村永世不忘！
@elif flag:xixi_done
村民|強人都被打跑了！保正，這是西溪村湊的一點謝禮！
@give amulet
@gold 150
@quest s3_xixi done
@else
村民|保正！西溪村那邊來了一夥強人，搶糧食、搶耕牛……他們就在村子東邊晃蕩！
村民|當年保正奪了我們村的青石寶塔，我們還不服氣……如今出了事，還是只能來求保正。
@if !qactive:s3_xixi
@quest s3_xixi
@end
@end`),
      K: chest('robe2', 1),
      E: exit('shijie', 'start', '石碣村', { cond: 'flag:gs_join', deny: '|村東大路。' }),
    },
    intro: `
|五更時分，鄆城縣都頭雷橫巡夜回來，押著一個赤髮黃鬚的大漢，到晁蓋莊上歇腳。
雷橫|保正，我們在靈官殿上捉了這個大漢，正要押回縣裡。
|晁蓋走到門房一看——那漢子低聲道：
劉唐|小人劉唐，東潞州人氏，因鬢邊有搭朱砂記，人都喚我做「赤髮鬼」。特送一套富貴與保正哥哥！
晁蓋|（心中明白，大聲道）你這廝！是我外甥王小三，十來歲離家，怎麼在靈官殿上睡覺？
雷橫|原來是保正的令甥！誤會，誤會！
晁蓋|都頭辛苦，這十兩銀子給弟兄們買酒吃。
|雷橫收了銀子，帶著土兵走了。
劉唐|哥哥！那雷橫詐了你十兩銀子，我去討回來！
晁蓋|這……罷了，你要去便去，我隨後跟你。
@join liutang
@flag lt_join
@quest q3_liutang done
@quest q3_leiheng
|（雷橫往村東口去了。）`,
  },

  shijie: {
    name: '石碣村', ch: 3, bg: 'bg_river', battleBg: 'bg_river', bgm: 'water', ground: '~', boat: true, anim: true,
    grid: `
############################
#,,,RRR,,,,,,,,,,,,,RRRR,,,#
#,,,RRR,,TT,,,,,TT,,RRRR,,,#
#,,,=A=,,,,,,,,,,,,,,=E=,,,#
#~~~~~~~~~rrrrr~~~~~~~~~~~~#
#~~~~~~~~~rr~~r~~~~~~G~~~~~#
#~~rrr~~~~~~~~r~~~rrrrrr~~~#
#~~r~X~~~~rr~~~~~~r~~~~r~~~#
#~~r~~~~rrrr~~rrrrr~~K~r~~~#
#~~rrr~~r~~~~~~~~~~~~~~r~~~#
#~~~~~~~r~~H~~~rrrr~rrrr~~~#
#~rrrrrrr~~~~~~r~~~~~~~~~~~#
#~~~~~~~~~~rrrrr~~Z~~rrrrr~#
#~~~~G~~~~~~~~~~~~~~~r~~~~~#
#rrrrrr~~~rrrrr~~~~~~r~Q~~~#
#,,,,,=~~~=,,,,rrrrrrr~~~~~#
#,,RRR=1~~=,,,,,,,,,,,,,,,,#
#,,RRR,,,,,,,,,,TT,,,,,,TT,#
############################`,
    marks: {
      '1': entry('start'),
      A: npc('阮小七', 'p_ruanxiaoqi', `
@if !flag:rx_join
阮小七|教授！好久不見！這幾年梁山泊被一夥強人佔了，不許打魚，咱們兄弟窮得叮噹響！
吳用|小七，若有一套富貴，你們兄弟可願取？
阮小七|（拍著脖子）這腔熱血，只要賣與識貨的！教授說吧，什麼富貴？
吳用|晁保正要劫梁中書送給蔡太師的生辰綱，十萬貫不義之財。
阮小七|劫生辰綱？！痛快！痛快！我這就叫二哥、五哥一起去！
|阮小二、阮小五在家照顧老娘，阮小七先跟著晁蓋一行人走。
@join ruanxiaoqi
@flag rx_join
@quest q3_ruan done
@quest q3_gang
@if !quest:s3_fish
阮小七|只是……我老娘病了好些天，什麼都吃不下，說想吃一尾金色鯉魚。這水面上，偶爾能看到金光……
@quest s3_fish
@end
@elif item:k_fish & !quest:s3_fish
阮小七|金色鯉魚！哥哥們真找到了！老娘有救了！
@take k_fish
|阮小七的老娘吃了鯉魚湯，精神好了許多。阮小二拿出一件家傳的寶貝相贈。
@give nopoison
@quest s3_fish done
@else
阮小七|哥哥們，該去黃泥岡了！碼頭在東北邊。
@end`),
      X: trig(`@run fish_spot`, { once: false, visible: true, name: '漣漪' }),
      H: npc('漁夫', 'n_elder', `漁夫|那梁山泊的王倫，連打魚都不許，咱們只能在這石碣湖裡打些小魚……
漁夫|官府的巡船也常來勒索，好漢小心。`),
      Z: npc('船家', 'n_waiter', `船家|蘆葦蕩裡水路彎彎曲曲，認準方向。阮家兄弟在西北邊的碼頭。`),
      G: foe('pirate@13+pirate@12', { name: '水賊' }),
      K: chest('herb', 4),
      Q: foe('archer@13+soldier@13', { name: '巡船' }),
      E: exit('huangnigang', 'start', '黃泥岡', { cond: 'flag:rx_join', deny: '吳用|先找到阮小七。他家在西北邊碼頭。', under: '=' }),
    },
    intro: `
|吳用帶著晁蓋等人來到石碣村。此村四面是水，只有坐船才能往來。
吳用|阮氏三雄：立地太歲阮小二、短命二郎阮小五、活閻羅阮小七。都是水上好漢。
|（乘船在水上移動。蘆葦叢擋住去路，要繞路而行。）`,
  },

  huangnigang: {
    name: '黃泥岡', ch: 3, bg: 'bg_huangnigang', bgm: 'field', ground: '.', weather: 'heat',
    grid: `
############################
#^^^^^^^^^^^^^^^^^^^^^^^^^^#
#^^TTTTT,,,,,,,,,,,TTTTTT^^#
#^TT,,,,,,,,Y,,,,,,,,,,TT^^#
#^T,,,,,,,,,,,,,,,,,,,,,T,^#
#^,,,B,,,A,,,,,,,,,,,,,,,,^#
#^^,,,,,,,,,,,,,,,,,,,,,,^^#
#^^^......^^^^^^^......^^^^#
#^^^......^^^^^^^...H..^^^^#
#^^^..G...^^^^^^^......^^^^#
#^^^^.....^^^^^^^^.....^^^^#
#^^^^^....^^^^^^^^....^^^^^#
#^^^^^^...............^^^^^#
#^^^^^^..W.......J....^^^^^#
#^^^^^^...............^^^^^#
#^^^^^^^^.....K....^^^^^^^^#
#^^^^^^^^^^...1..^^^^^^^^^^#
#^^^^^^^^^^^^.E.^^^^^^^^^^^#
############################`,
    marks: {
      '1': entry('start'),
      A: npc('楊志', 'p_yangzhi', `
@if !flag:yz_done
楊志|（烈日下滿頭大汗）都給我起來趕路！這黃泥岡上，正是強人出沒的地方！
軍漢|提轄，天這樣熱，走不動了，歇一歇吧！
@end`, { show: '!flag:yz_done', ring: '#c33' }),
      B: npc('老都管', 'e_yamen', `老都管|楊提轄，你也忒狠了！軍漢們走不動，歇一歇又何妨！`, { show: '!flag:yz_done', tint: 'sepia(.7)' }),
      Y: trig(`@run gang_plan`, { once: false }),
      W: npc('白勝', 'n_waiter', `
@if !flag:gang_ready
白勝|（挑著兩桶酒）晁大哥，吳教授說了，等你們把棗車推上岡去，我再上去。
@elif !flag:yz_done
白勝|我這就挑酒上岡去！
@else
白勝|嘿嘿，大功告成！
@end`),
      J: npc('吳用', 'p_wuyong', `
@if !flag:gang_ready
吳用|眾位兄弟，楊志精細，硬搶必有死傷。咱們扮作販棗子的客商，推著七輛江州車，先上岡去松林裡歇涼。
吳用|等白勝挑酒上來，再依計行事。走吧——松林在岡頂。
@flag gang_ready
@else
吳用|計已定好，就看今日了。
@end`, { show: '!flag:gang_ready' }),
      G: foe('soldier@14+archer@13', { name: '押運軍漢' }),
      H: foe('soldier@14+soldier@14+archer@13', { name: '押運軍漢' }),
      K: chest('wine2', 2),
      E: exit('marsh', 'start', '下岡', { cond: 'flag:yz_done', deny: '吳用|楊志一行就在岡頂，豈能錯過？' }),
    },
    intro: `
|六月初四。押運生辰綱的楊志一行人，在烈日下走上黃泥岡。
|這黃泥岡上，正是晁蓋等七人等候已久的地方。`,
  },

  marsh: {
    name: '梁山泊・蘆葦蕩', ch: 3, bg: 'bg_marsh', bgm: 'water', ground: '~', boat: true, anim: true, weather: 'fog',
    grid: `
##############################
#,,,,,,,RRRR,,,,,,,,,,,,,,,,,#
#,,,,,,,RR+R,,,,,,,,,,,,,,,,,#
#rrrrrr==E==rrrrrrrrrrrrrrrrr#
#r~~~~~~~~~~~~~~r~~~~~~~~~~~r#
#r~rrrrrrrrrrr~~r~~rrrrrrr~~r#
#r~r~~~~~~~~~r~~r~~r~~~~~r~~r#
#r~r~rrrrrr~~r~~~~~r~K~~~r~~r#
#r~r~r~~~~r~~rrrrrrr~~~rrr~~r#
#r~~~r~G~~r~~~~~~~~~~~~r~~~~r#
#rrrrr~~~~rrrrrrrr~~rrrr~rrrr#
#r~~~~~~~~~~~~~~~r~~~~~~~~~~r#
#r~~rrrrrrrr~~H~~r~~rrrrrr~~r#
#r~~r~~~~~~r~~~~~r~~r~~~~r~~r#
#r~~r~~C~~~r~~rrrr~~r~~Q~r~~r#
#r~~r~~~~~~~~~r~~~~~~~~~~~~~r#
#r~~rrrrrrrrrrr~~~~rrrrrrr~~r#
#r~~~~~~~~~~~~~~~~~~~~~~~~~~r#
#rrrrrrrrrrrrrr~1~rrrrrrrrrrr#
##############################`,
    marks: {
      '1': entry('start'),
      G: foe('soldier@15+archer@15', { name: '官船' }),
      H: foe('armored@14+soldier@15', { name: '官船' }),
      Q: foe('archer@15+archer@15+soldier@15', { name: '官船' }),
      K: chest('pill', 2),
      C: chest('boots', 1),
      E: exit('zhugui', 'start', '朱貴酒店', { under: '=', script: `
|眾人棄了船，上了岸。蘆葦叢邊，一座酒店，挑出一面酒旗。
吳用|這便是柴大官人說的——梁山泊頭領朱貴開的酒店。
@quest q3_flee done
@exp 100
@title 第三回・終/七星聚義/晁蓋等人劫得生辰綱，卻因白勝被捕而事發。在鄆城押司宋江冒死通風報信之下，七人逃往梁山泊。
@run ch4_start
@end` }),
    },
    intro: `
|晁蓋等人劫了生辰綱，不料白勝在家中被捕，供出了眾人。鄆城縣押司宋江冒死通風報信，眾人連夜出逃。
|濟州府緝捕使臣何濤帶著官兵乘船追來。阮小七熟悉水路，帶眾人駛入茫茫蘆葦蕩……
阮小七|哥哥們坐穩了！這蘆葦蕩裡的水路，我閉著眼睛都認得！
公孫勝|貧道借一陣東風，燒他的官船！
|（穿過蘆葦迷宮，往北方的梁山泊去。官船擋路時須擊退。）
@quest q3_flee`,
  },
};

scripts.gang_plan = `
@if !flag:gang_ready
|（岡頂有一隊人在松林下歇涼——是楊志的押運隊伍。先聽聽吳用的計策。）
@elif !flag:yz_done
|晁蓋等七人推著江州車，在松林裡歇涼，脫了衣裳搧涼。
楊志|（提著朴刀趕來）你們是什麼人？！
晁蓋|我們是濠州販棗子的客商，天熱在此歇涼。
楊志|……原來是客商。
|不一會兒，一個漢子挑著一副擔桶，唱上岡來——
白勝|赤日炎炎似火燒，野田禾稻半枯焦。農夫心內如湯煮，公子王孫把扇搖！
軍漢|好酒！咱們買碗酒吃！
楊志|不許吃！你們不知道江湖上多少好漢被蒙汗藥麻翻了！
吳用|（暗中吩咐）先由我們買一桶，當著他們的面吃。
@choice 先買一桶，眾人當面喝乾|直接把藥下在酒裡賣給軍漢
@if choice:2
吳用|不可！楊志精細，必不肯讓軍漢們吃。咱們得先讓他們放下戒心。
@choice 先買一桶，眾人當面喝乾|算了，再想想
@end
@if choice:1
|晁蓋等人買了一桶酒，當著眾軍漢的面，七人輪流舀著吃了個乾淨。
|吳用又去另一桶裡舀了一瓢——白勝劈手奪下，倒回桶裡。原來那一瓢裡，早已下了蒙汗藥。
@choice 讓白勝嚷著「不賣了」|立刻便宜賣給軍漢
@if choice:1
白勝|你們這般白吃，不賣了！不賣了！
軍漢|提轄，那夥客商吃了一桶都沒事，咱們也買一桶吧！
老都管|楊提轄，就讓他們吃一碗吧！
楊志|……罷了，快吃了趕路。
|十五個人都吃了酒。楊志口渴難耐，也吃了半瓢。
|只聽吳用、晁蓋等七人立在松樹旁邊，指著這十五人說道：
吳用|倒也！倒也！
|軍漢們一個個頭重腳輕，面面廝覷，都軟倒了。楊志卻只吃了半瓢，咬著牙站了起來！
楊志|你們……好計……我楊志……拚了這條命！
@battle yangzhi+laodouguan bg=bg_huangnigang
|楊志終究藥力發作，眼睜睜看著七人把十一擔金珠寶貝裝上江州車，推下岡去。
楊志|（醒來後長嘆）失了生辰綱，如何回去見梁中書？……不如就在這岡上尋個死處！
|楊志想了想，終究撩衣破步，望著黃泥岡下便走。
@give k_map
@gold 300
@flag yz_done
@quest q3_gang done
@exp 80
@else
楊志|且慢！你們怎麼這麼急著賣？其中必有古怪！
吳用|（不好，露了破綻。重來一次吧。）
@end
@else
吳用|……且再想想。
@end
@end`;

export default { maps, scripts, quests, chapters };
