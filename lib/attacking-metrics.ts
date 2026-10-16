import type {PlayerStat} from './dashboard-data';
export const attackingMetrics=[
 {key:'fmXg',label:'xG · FotMob',group:'预期表现 · FotMob'}, {key:'fmXg90',label:'xG / 90 · FotMob',group:'预期表现 · FotMob'},
 {key:'xa',label:'预期助攻 · xA',group:'预期表现 · FotMob'}, {key:'xa90',label:'xA / 90',group:'预期表现 · FotMob'},
 {key:'xgi',label:'xGI · xG + xA',group:'预期表现 · FotMob'}, {key:'xgi90',label:'xGI / 90',group:'预期表现 · FotMob'},
 {key:'shots',label:'射门次数',group:'进攻动作 · Statz'}, {key:'shots90',label:'射门 / 90',group:'进攻动作 · Statz'},
 {key:'crosses',label:'传中次数',group:'进攻动作 · Statz'}, {key:'crosses90',label:'传中 / 90',group:'进攻动作 · Statz'},
 {key:'dribbles',label:'成功过人次数',group:'进攻动作 · Statz'}, {key:'dribbles90',label:'成功过人 / 90',group:'进攻动作 · Statz'},
] as const;
export type AttackKey=typeof attackingMetrics[number]['key']|'fmXgPerGame'|'xaPerGame'|'xgiPerGame'|'shotsPerGame'|'crossesPerGame'|'dribblesPerGame';
export const attackingColumns=[{key:'fmXgPerGame',label:'xG / 场'},{key:'fmXg90',label:'xG / 90'},{key:'xaPerGame',label:'xA / 场'},{key:'xa90',label:'xA / 90'},{key:'xgiPerGame',label:'xGI / 场'},{key:'xgi90',label:'xGI / 90'},{key:'shotsPerGame',label:'射门 / 场'},{key:'shots90',label:'射门 / 90'},{key:'crossesPerGame',label:'传中 / 场'},{key:'crosses90',label:'传中 / 90'},{key:'dribblesPerGame',label:'成功过人 / 场'},{key:'dribbles90',label:'成功过人 / 90'}] as const;
const keys=new Set<string>([...attackingMetrics,...attackingColumns].map(m=>m.key));
export const isAttackKey=(key:string):key is AttackKey=>keys.has(key);
export function attackingValue(player:PlayerStat,key:AttackKey):number|null {
 const a=player.attacking;if(!a||player.position==='GK')return null;
 const per90=key.endsWith('90'),perGame=key.endsWith('PerGame');
 const base=key.replace(/90$|PerGame$/,'');
 const expected=['fmXg','xa','xgi'].includes(base),value=base==='fmXg'?a.xg:base==='xa'?a.xa:base==='xgi'?a.xgi:base==='shots'?a.shots:base==='crosses'?a.crosses:a.dribbles;
 if(value==null||!Number.isFinite(value))return null;
 if(per90||perGame){const denominator=per90?(expected?a.mins:a.actionMins):(expected?a.apps:a.actionApps);return denominator&&denominator>0?value*(per90?90:1)/denominator:null;}
 return value;
}
