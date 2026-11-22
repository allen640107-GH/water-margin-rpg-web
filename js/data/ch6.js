// 第六回：宋公明三打祝家莊（祝家店、李家莊、盤陀路、祝家莊）
import { npc, foe, boss, exit, chest, money, entry, sign, trig, gate, boulder, plate, reset, obj, sw } from './mk.js';

const chapters = {
  6: { title: '宋公明三打祝家莊', sub: '獨龍岡上三座莊院，祝家莊最為強橫。一隻報曉公雞，竟引出一場大戰。' },
};

const quests = {
  q6_rooster: { name: '一隻公雞', desc: '吳用說：獨龍岡祝家莊辱罵梁山。從梁山渡口出發，往南方的祝家店打探。' },
  q6_li: { name: '撲天鵰李應', desc: '到李家莊拜會李應，請他引路。' },
  q6_maze: { name: '盤陀路', desc: '祝家莊外是迷宮般的盤陀路。「見白楊樹便轉彎」。' },
  q6_zhu: { name: '三打祝家莊', desc: '攻破祝家莊：放下吊橋，擊敗祝氏三傑與教師欒廷玉。' },
  q6_hu: { name: '一丈青扈三娘', desc: '扈家莊與祝家莊結盟。往李家莊西邊的扈家莊，讓扈家莊不再相助祝家。' },
  s6_hutai: { name: '扈太公的心事', desc: '扈太公擔心莊外祝家兵丁騷擾，替他趕走。', side: true },
  s6_well: { name: '鍾離老人的井', desc: '鍾離老人家的井被祝家莊兵丁填了，幫他清出來。', side: true },
};

const scripts = {
  hutai_chk: `
@if flag:k:hujia:7,10 & flag:k:hujia:17,10 & !flag:hutai_ok
@flag hutai_ok
|騷擾扈家莊的祝家兵丁都被趕走了。回去告訴扈太公吧。
@end`,
  ending: `
@if !flag:ch6_done
@flag ch6_done
@cg bg_juyiting
|三打祝家莊，梁山大獲全勝。宋江下令：不許傷害獨龍岡的百姓，每戶分給一石糧食。
宋江|眾位兄弟！自今日起，梁山泊高舉「替天行道」大旗——除暴安良，保境安民！
晁蓋|好！從今往後，梁山泊有福同享，有難同當！
林沖|林沖這條命，從山神廟那一夜起，就交給了梁山。
魯智深|灑家只要有酒有肉，跟著哥哥們，打盡天下不平事！
武松|哥哥們，乾了這碗！
李逵|乾！乾！哈哈哈哈！
吳用|（撚鬚微笑）天罡地煞，終將聚首……
|後來的故事，人人皆知——一百單八將齊聚忠義堂，梁山泊的名號響徹天下。
|而這一段：林沖雪夜、武松打虎、七星聚義、法場劫囚、三打祝家莊——正是梁山故事的開始。
@cg off
@ending
@end`,
};

const maps = {
  zhudian: {
    name: '獨龍岡・祝家店', ch: 6, bg: 'bg_tavern', bgm: 'town', ground: ',',
    grid: `
##########################
#TT,,,,,,,,,,,,,,,,,,,,TT#
#T,,RRRRRRRR,,,,,,,,,,,,T#
#,,,RRRRRRRR,,,,,G,,,,,,,#
#,,,RRR+RRRR,,,,,,,,,,,,E#
#,,,,,,A,,,,,,,,,,,,,,,,,#
#,,,,,,,,,,,,,,,,,TTT,,,,#
#,,K,,,,,::::::,,,TTT,,H,#
#,,,,,,,,:,,,,:,,,,,,,,,,#
#,,,,,B,,:,,,,:,,,,J,,,,,#
#TT,,,,,,::::::,,,,,,,,TT#
#TTT,,,,,,,1,,,,,,,,,,TTT#
#TTTTTTTT,,X,,TTTTTTTTTTT#
##########################`,
    marks: {
      '1': entry('start'),
      X: exit('tianxia', 'liangshan', '回梁山'),
      A: npc('時遷', 'p_shiqian', `
@if !flag:sq_join
時遷|（抱著一隻烤雞）嘿嘿嘿，各位好漢，來一塊？這可是祝家店的報曉公雞，香得很！
店小二|那是我們店裡報曉的公雞！你們這幫賊，偷吃了公雞！
時遷|一隻雞而已，大不了賠你錢嘛。
店小二|賠？這是祝家莊的店！祝家三位少莊主說了，要捉了梁山泊的賊去請功！來人哪！
時遷|糟了，是梁山泊的哥哥們？！小人時遷，人稱「鼓上蚤」，正要上梁山入夥！哥哥們救命！
宋江|……既是要投梁山的兄弟，我們便不能不管。
@battle militia@24+militia@24+dog@24 bg=bg_tavern
|莊客們被打得落荒而逃。
時遷|多謝哥哥！小人別的不會，飛簷走壁、開鎖偷東西，那是天下第一！
@join shiqian
@flag sq_join
@give k_rooster
宋江|（嘆氣）一隻雞……只怕祝家莊要藉此生事了。
吳用|哥哥，祝家莊早就揚言要捉盡梁山好漢。這一戰，是躲不過的。東邊是李家莊，莊主李應與祝家有生死之盟，不妨先去拜會。
@quest q6_rooster done
@quest q6_li
@end`, { show: '!flag:sq_join' }),
      B: npc('店小二', 'n_waiter', `
@if flag:sq_join
店小二|好、好漢饒命……要吃什麼隨便拿……
@shop zhuzhuang
@else
店小二|客官要住店？我們這是祝家莊的店，梁山泊的人可不招待！
@end`),
      G: foe('militia@24+militia@23', { name: '巡莊莊客' }),
      H: foe('dog@24+dog@24+militia@23', { name: '巡莊莊客' }),
      J: npc('樵夫', 'n_villager', `樵夫|獨龍岡上三座莊：祝家莊、扈家莊、李家莊。三莊結盟，祝家最強，有個教師叫欒廷玉，一條鐵棒天下無敵……`),
      K: chest('armor4', 1),
      E: exit('lijia', 'start', '李家莊', { cond: 'flag:sq_join', deny: '|往東是李家莊。' }),
    },
    intro: `
|獨龍岡。三座莊院虎踞龍盤，各有莊兵數千。祝家莊的莊門上，掛著一面白旗：
|「填平水泊擒晁蓋，踏破梁山捉宋江。」
李逵|好大的口氣！哥哥，讓鐵牛去砍了那面鳥旗！
宋江|且慢，先探明虛實。`,
  },

  lijia: {
    name: '李家莊', ch: 6, bg: 'bg_village', bgm: 'town', ground: ',',
    grid: `
##########################
#TT,,,,,RRRRRRRRR,,,,,,TT#
#T,,,,,,RRRRRRRRR,,,,,,,T#
#,,,,,,,RRRR+RRRR,,,,,,,,#
#U2,,,,,,,,,A,,,,,,,,,,,,#
#,,,,,,,::::::::::,,,,,,,#
#,K,,,,,:,,,,,,,,:,,,G,,,#
#,,,,,,,:,,B,,,,,:,,,,,,,#
#,,,,,,,::::::::::,,,,,,,#
#,,,RRRR,,,,,,,,,,,RRR,,,#
#,,,RR+R,,,,,,,,,,,R+R,,,#
#,,,,C,,,,,,,,,,,,,,W,,,E#
#TT,,P,,,,,,,,,,,,,,,,,TT#
#TTT,,,,,,,,,1,,,,,,Z,TTT#
#TTTTTTTTTTTTX,TTTTTTTTTT#
##########################`,
    marks: {
      '1': entry('start'),
      X: exit('zhudian', 'start', '祝家店'),
      A: npc('李應', 'n_noble', `
@if !flag:li_done
李應|在下李應，人稱「撲天鵰」。梁山泊的好漢光臨，有失遠迎。
宋江|李莊主，祝家莊與我梁山結怨，宋江不願妄動刀兵，想請莊主從中說和。
李應|……我寫一封信給祝朝奉，請他息事寧人。杜興，你送去。
|過了半日，杜興滿臉怒氣地回來。
杜興|莊主！祝彪那廝把信撕了，還罵莊主私通梁山！
李應|豈有此理！三莊結盟，他竟如此無禮！備馬，我親自去！
|又過了一個時辰，李應被家丁們抬了回來，臂上中了一箭。
李應|祝彪……那小畜生，竟敢暗箭傷我！
李應|宋頭領，李應與祝家，從此一刀兩斷！這是我李家莊的令牌，獨龍岡上的關卡，見令牌便放行。
@give k_lipass
李應|只是祝家莊外有一條「盤陀路」，曲曲折折，到處是陷坑。不知道走法的，進得去出不來。
李應|村裡的鍾離老人在這岡上住了一輩子，或許知道。
@flag li_done
@quest q6_li done
@quest q6_maze
李應|還有一事：西邊的扈家莊與祝家莊結了親。扈太公的女兒「一丈青」扈三娘，使兩口日月雙刀，武藝了得。
李應|若不先穩住扈家莊，打祝家莊時，必被兩面夾擊。
@quest q6_hu
@else
李應|宋頭領，祝家莊就拜託了。李應傷好之後，再來相助！
@end`),
      B: npc('杜興', 'e_militia', `杜興|小人杜興，李家莊主管。我們莊主為人仗義，祝家那幫人卻目中無人……`, { tint: 'hue-rotate(60deg)' }),
      C: npc('鍾離老人', 'n_elder', `
@if !flag:li_done
鍾離老人|老漢是這裡的村民。你們……是梁山泊的人？
@elif !flag:poplar
鍾離老人|好漢要走盤陀路？……老漢看你們不像壞人。祝家莊欺壓鄉里，大家早就恨透了。
@if !quest:s6_well
鍾離老人|只是老漢家的井被祝家兵丁填了石頭，老漢要挑水得走三里路……
@if !qactive:s6_well
@quest s6_well
@end
@else
鍾離老人|你幫老漢清了井，老漢便告訴你——
鍾離老人|盤陀路的秘訣是：「見白楊樹便轉彎」！不論路寬路窄，只要有白楊樹，便是活路；沒有白楊樹的岔路，都是死路，有陷坑和伏兵！
@give k_poplar
@flag poplar
@end
@else
鍾離老人|記住了，見白楊樹便轉彎！
@end`),
      W: npc('老漢的井', 'well', `
@if qactive:s6_well
|井口被大石頭和泥土堵得嚴嚴實實。
@choice 叫李逵、魯智深搬開大石頭|算了
@if choice:1
李逵|讓開讓開！鐵牛來！
@shake
|轟隆一聲，大石頭被搬開了！井裡的泥土也挖了出來，清水湧了上來。
鍾離老人|好！好！好漢真是神力！
@quest s6_well done
@hide W
@end
@else
|一口被石頭填住的井。
@end`, { img: 'well', show: '!quest:s6_well' }),
      G: foe('militia@24+archer@24', { name: '祝家探子' }),
      P: foe('dog@24+dog@24+militia@24', { name: '祝家探子' }),
      Z: foe('archer@24+archer@24+militia@23', { name: '祝家探子' }),
      K: chest('pill', 3),
      E: exit('pantuolu', 'start', '盤陀路', { cond: 'flag:poplar & flag:hu_done', deny: `
@if !flag:poplar
李應|盤陀路沒人引路，萬萬去不得！先找鍾離老人問問。
@else
吳用|且慢。西邊扈家莊未定，貿然深入，恐被兩面夾擊。先去扈家莊吧。
@end` }),
      U: exit('hujia', 'start', '扈家莊', { cond: 'flag:li_done', deny: '|往西是扈家莊。先拜會李莊主再說。' }),
      '2': entry('hujia'),
    },
    intro: `
|李家莊。莊院高大，門前一條清溪，橋上站著幾個莊丁。
@quest q6_li`,
  },

  hujia: {
    name: '扈家莊', ch: 6, bg: 'bg_village', battleBg: 'bg_zhujiazhuang', bgm: 'field', ground: ',',
    grid: `
##########################
#^^^^^^RRRRRRRRRRRR^^^^^^#
#^^TT,,RRRRRR+RRRRR,,TT^^#
#^T,,,,,,,,,,Z,,,,,,,,,T^#
#^,,,,,,,,,,,,,,,,,,,,,,^#
#^,,K,,,,G,,,,,,H,,,,,,,^#
#^RRR,,,,,,,,,,,,,,,,RRR^#
#^RRR,,,,,,,,,,,,,,,,RRR^#
#^,,,,,,,A,,,,,,,,,B,,,,^#
#^TT,,,,,,,,,,,,,,,,,,TT^#
#^^T,,,J,,,,,,,,,P,,,,T^^#
#^^^,,,,,,,,,,,,,,,,,,^^^#
#^^^^,,,,,,,X,,,,,,,^^^^^#
#^^^^^,,,,,,,,,,,,,^^^^^^#
#^^^^^^,,,,,,,,,,,^^^^^^^#
#^^^^^^^,,,,,,,,,^^^^^^^^#
#^^^^^^^^^^^1E^^^^^^^^^^^#
##########################`,
    marks: {
      '1': entry('start'),
      E: exit('lijia', 'hujia', '李家莊'),
      X: trig(`
@if !flag:hu_meet
|剛到扈家莊外，一彪人馬從莊裡衝出。為首一員女將，騎一匹青鬃馬，手使兩口日月雙刀。
扈三娘|梁山泊的草寇，也敢來獨龍岡撒野！
李逵|好兇的婆娘！鐵牛來會會你！
扈三娘|（冷笑）黑廝，看刀！
@battle militia@25+militia@25+archer@24 bg=bg_zhujiazhuang
|扈三娘雙刀翻飛，李逵竟招架不住，被逼退了好幾步。扈三娘見好就收，退回莊中去了。
李逵|哎呀呀……那婆娘好快的刀！
林沖|（沉吟）這女將刀法精妙，不可小覷。待林沖去會她。
@flag hu_meet
@end`),
      A: npc('扈家莊民', 'n_woman', `
@if flag:hu_done
婦人|扈家莊不打仗了，真是謝天謝地。
@else
婦人|我們三娘子是獨龍岡第一女將，和祝家三少爺祝彪訂了親。
婦人|其實扈家莊的人都不喜歡祝家。祝家仗勢欺人，連扈太公都受他們的氣……
@end`),
      B: npc('扈太公', 'n_elder', `
@if quest:s6_hutai
扈太公|多謝好漢們。扈家莊不會再幫祝家了。
@elif flag:hutai_ok
扈太公|祝家的兵丁都被趕走了！老漢……老漢不知如何報答。這株老參，請好漢收下。
@give elixir
@give elixir
@quest s6_hutai done
@else
扈太公|你們……是梁山泊的人？老漢不想打仗。只是祝家硬拉扈家莊下水……
扈太公|莊子南邊來了幾隊祝家莊的兵丁，名為「助戰」，實則在莊裡吃喝搶掠。好漢若能趕走他們……
@if !qactive:s6_hutai
@quest s6_hutai
@end
@end`),
      G: foe('militia@25+militia@25', { name: '扈家莊丁' }),
      H: foe('militia@25+archer@25', { name: '扈家莊丁' }),
      J: foe('militia@25+dog@25+dog@24', { name: '祝家兵丁', post: `@run hutai_chk` }),
      P: foe('armored@25+archer@25', { name: '祝家兵丁', post: `@run hutai_chk` }),
      K: chest('elixir', 1),
      Z: trig(`
@if !flag:hu_done
|扈家莊門前。扈三娘和她的兄長扈成擺開陣勢。
扈成|梁山好漢，我扈家與你們無冤無仇！何苦相逼？
宋江|扈莊主，宋江不願與扈家為敵。只要扈家莊不助祝家，梁山絕不犯扈家一草一木。
扈三娘|哼，花言巧語！哥哥，別聽他的！
@battle hucheng+militia@25+militia@25 bg=bg_zhujiazhuang
扈三娘|哥哥退後！我來！
@battle hu3niang bg=bg_zhujiazhuang
|林沖挺丈八蛇矛，與扈三娘鬥了十數合。賣個破綻，放她雙刀砍進來，把矛一逼，輕舒猿臂，將扈三娘活捉過馬！
扈三娘|放開我！
林沖|姑娘刀法很好。只可惜跟錯了人。
扈成|（下馬拜倒）宋頭領！扈成願降！從此扈家莊閉門自守，絕不再助祝家一兵一卒！
宋江|好。三娘子先送上梁山，好生看待，待祝家莊事了，再說不遲。
@flag hu_done
@quest q6_hu done
@exp 200
吳用|好，西邊已定。如今可以放心去走盤陀路了。
@end`),
    },
    intro: `
|扈家莊。莊前一條小河，河邊栽著一排垂柳。莊門上插著「扈」字大旗。`,
  },

  pantuolu: {
    name: '盤陀路', ch: 6, bg: 'bg_pantuolu', bgm: 'dungeon', ground: '.', weather: 'fog',
    grid: `
#############################
#FFFFFFFFFFFFFFFFFFFFFFFEFFF#
#F....GF.......F...........F#
#F.F.FFF.FFFFF.F.FFF.cFFFF.F#
#F.F.....F.....F.F...FL....F#
#F.FFFFFFF.FFFFF.F.FFFFF.FFF#
#F...F...F.....F.F.....F..MF#
#FFF.F.F.FFFFF.F.FFFFF.FFFFF#
#F...F.F.FK..F.......F.....F#
#F.FFF.F.FFF.FFFFFFFFFFFFF.F#
#F...F.F.....F...F.......F.F#
#FFF.F.FFFFFFF.F.F.FFFFF.F.F#
#F...F...F.....F...F.....F.F#
#F.FFF.F.F.FFFFFFFFF.FFFFb.F#
#F.FJ..F.F.F.......F...F...F#
#F.FFFFF.F.FFFFF.F.FFF.aFF.F#
#F.......F....1FHF.........F#
#FFFFFFFFFFFFFFFFFFFFFFFFFFF#
#############################`,
    marks: {
      '1': entry('start'),
      a: obj('tree_poplar', '一棵白楊樹。樹皮雪白，在密林中格外醒目。', { name: '白楊', scale: 1.2 }),
      b: obj('tree_poplar', '一棵白楊樹。樹皮雪白，在密林中格外醒目。', { name: '白楊', scale: 1.2 }),
      c: obj('tree_poplar', '一棵白楊樹。樹皮雪白，在密林中格外醒目。', { name: '白楊', scale: 1.2 }),
      G: trig(`
|腳下一空——陷坑！四周伏兵齊出！
@battle militia@25+militia@25+archer@24 bg=bg_pantuolu
時遷|哥哥，這條路沒有白楊樹，是死路！`),
      H: trig(`
|草叢裡突然伸出撓鉤！伏兵！
@battle militia@25+dog@25+dog@25 bg=bg_pantuolu
吳用|此處沒有白楊樹……果然是陷阱。`),
      L: trig(`
|竹籤陷阱！眾人小心避過，林子裡卻殺出一隊莊兵！
@battle armored@25+militia@25 bg=bg_pantuolu
宋江|記住了——見白楊樹才轉彎。`),
      J: chest('thunder', 2),
      K: chest('elixir', 1),
      M: chest('wine2', 3),
      E: exit('zhujiazhuang', 'start', '祝家莊', { script: `
|眾人走出了盤陀路，祝家莊就在眼前。
@quest q6_maze done` }),
    },
    intro: `
|盤陀路。四周盡是一人多高的密林，小路彎彎曲曲，看上去條條相似。
時遷|哥哥，鍾離老人說「見白楊樹便轉彎」。白楊樹是白色樹皮的那種。
|（迷宮：岔路口旁有白楊樹的方向是活路。走錯會遇到陷坑伏兵。）`,
  },

  zhujiazhuang: {
    name: '祝家莊', ch: 6, bg: 'bg_zhujiazhuang', bgm: 'boss', ground: ':',
    grid: `
##############################
#RRRRRRRRRRRRRRRRRRRRRRRRRRRR#
#RRRRRRRRRRRR+RRRRRRRRRRRRRRR#
#::::::::::::Y:::::::::::::::#
#:::::::::::::::::::::::::::K#
#RRRR::::::::D::::::::::RRRR:#
#RRRR::::#########:::::RRRR::#
#R+RR::::#:::::::#::::RR+R:::#
#:A::::::#:::P:::#::::::B::::#
#::::::::#:::::::#:::::::::::#
#::H::::::::::::::::::::J::::#
#::::::::::::::::::::::::::::#
#~~~~~~~~~~~~=~~~~~~~~~~~~~~~#
#~~~~~~~~~~~~W~~~~~~~~~~~~~~~#
#,,,,,,,,,,,,,,,,,,,,,,,,,,,,#
#,,G,,,,,,,,,S,,,,,,,,,,Q,,,,#
#,,,,,,,,,,,,1,,,,,,,,,,,,,,,#
#TTTTTTTTTTTTX,TTTTTTTTTTTTTT#
##############################`,
    marks: {
      '1': entry('start'),
      X: exit('pantuolu', 'start', '盤陀路'),
      S: sw('zz_bridge', `
|時遷趁著夜色泅過壕溝，翻進莊牆，砍斷了吊橋的繩索！
@shake
|轟——吊橋落了下來！`, { name: '吊橋機關', show: 'flag:zz_guard' }),
      G: foe('militia@26+militia@26+archer@25', { name: '莊兵', post: `@run zz_guard_chk` }),
      Q: foe('armored@26+militia@26', { name: '莊兵', post: `@run zz_guard_chk` }),
      W: gate('flag:zz_bridge', '|吊橋高高吊起，壕溝又深又寬。得想辦法放下吊橋。'),
      H: foe('armored@27+militia@27+dog@26', { name: '莊兵' }),
      J: foe('militia@27+archer@27+archer@26', { name: '莊兵' }),
      A: npc('祝龍・祝虎', 'b_zhubiao', `
@if !flag:zz_lh
祝龍|梁山賊寇，竟敢打到祝家莊來！
祝虎|大哥，咱們兄弟一起上，叫他們有來無回！
@battle zhulong+zhuhu bg=bg_zhujiazhuang
|祝龍、祝虎雙雙敗走。
@flag zz_lh
@hide A
@end`, { ring: '#c33', tint: 'hue-rotate(200deg)' }),
      B: npc('祝彪', 'b_zhubiao', `
@if !flag:zz_biao
祝彪|宋江！上回我暗箭射傷李應，今天也叫你嘗嘗我的槍！
李逵|就是你射傷了李莊主？看斧！
@battle zhubiao bg=bg_zhujiazhuang
|祝彪被打落馬下，倉皇逃走。
@flag zz_biao
@hide B
@end`, { ring: '#c33' }),
      D: gate('flag:zz_lh & flag:zz_biao', '|內莊大門緊閉。先擊敗左右兩院的祝龍、祝虎和祝彪！'),
      P: npc('孫立', 'b_commander', `
孫立|宋頭領！在下孫立，是欒廷玉的師兄弟。我假意投靠祝家莊，做你們的內應！
孫立|欒廷玉就在正廳。他一條鐵棒天下無敵，你們要小心——我會在背後牽制他。
@if !flag:sunli
@flag sunli
@heal
@toast 孫立為眾人療傷，全隊完全回復！
@end`, { tint: 'hue-rotate(300deg)' }),
      K: chest('armor5', 1),
      Y: trig(`
@if !flag:zz_done
欒廷玉|（手提鐵棒，立在廳前）宋江，你連破我祝家三傑，果然有些本事。
欒廷玉|但是有我欒廷玉在，祝家莊就不會倒！
宋江|欒教師，祝家莊作惡多端，你何苦為他賣命？
欒廷玉|士為知己者死！看棒！
@battle luantingyu bg=bg_zhujiazhuang
|欒廷玉被孫立從背後一槍刺中，終於倒下。祝家莊——破了。
欒廷玉|……好……梁山好漢……名不虛傳……
@flag zz_done
@quest q6_zhu done
@exp 300
@run ending
@goto juyiting start
@end`),
    },
    intro: `
|祝家莊。四面一道闊港，莊前一座吊橋。莊牆上刀槍林立，箭樓密布。
|——一打祝家莊，宋江誤入盤陀路，折了幾員兵將；二打祝家莊，扈三娘力戰，又不能勝。
|如今是第三次了。
吳用|哥哥，先清掉壕溝外的莊兵，再設法放下吊橋！
@quest q6_zhu`,
  },
};

scripts.zz_guard_chk = `
@if flag:k:zhujiazhuang:3,15 & flag:k:zhujiazhuang:24,15 & !flag:zz_guard
時遷|哥哥，外圍莊兵清乾淨了！看我的——我游過去把吊橋放下來！到吊橋機關那裡吩咐我一聲。
@flag zz_guard
@end`;

export default { maps, scripts, quests, chapters };
