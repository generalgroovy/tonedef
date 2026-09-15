// Standalone rehearsal; imports no ToneDef source. Values/formulas transcribed from REBUILD.md.
import assert from 'node:assert/strict';
const natural=[0,2,4,5,7,9,11],letters='CDEFGAB';
const parse=text=>{const[,letter,acc,oct]=/^([A-G])([#b]*)(-?\d+)$/.exec(text);return {letter:letters.indexOf(letter),octave:+oct,midi:12*(+oct+1)+natural[letters.indexOf(letter)]+[...acc].reduce((n,c)=>n+(c==='#'?1:-1),0)};};
const interval=(a,b)=>{a=parse(a);b=parse(b);const st=b.midi-a.midi,d=(b.octave-a.octave)*7+b.letter-a.letter,k=Math.abs(d),base=natural[k%7]+12*Math.floor(k/7),delta=(d===0?Math.abs(st):st*Math.sign(d))-base,perfect=[0,3,4].includes(k%7);let quality=perfect?(delta===0?'P':delta>0?'A':'d'):(delta===0?'M':delta===-1?'m':delta>0?'A':'d');return [quality+(k+1),st];};
assert.equal(parse('E2').midi,40);assert.equal(parse('B#3').midi,60);assert.equal(parse('E2').midi+2,42);assert.equal(parse('E2').midi+5,45);
for(const[a,b,quality,st]of [['C4','E4','M3',4],['C4','Eb4','m3',3],['E4','C4','M3',-4],['C4','E5','M10',16],['C4','Fb4','d4',4],['B#4','C5','d2',0]])assert.deepEqual(interval(a,b),[quality,st]);
const mod=n=>(n%12+12)%12,mask=(tonic,offsets)=>offsets.reduce((m,x)=>m|(1<<mod(tonic+x)),0);assert.equal(mask(0,[0,2,4,5,7,9,11]),2741);assert.equal(mask(9,[0,2,3,5,7,8,10]),2741);
const strings=[40,45,50,55,59,64],frets=[null,3,2,0,1,0],midis=frets.flatMap((f,i)=>f===null?[]:[strings[i]+f]);assert.deepEqual(midis,[48,52,55,60,64]);assert.deepEqual([...new Set(midis.map(mod))],[0,4,7]);assert.deepEqual([50,53,57].map((m,i)=>m-[48,52,55][i]),[2,1,2]);
function seededRandom(seed){let a=seed>>>0;return()=>{a=(a+0x6D2B79F5)>>>0;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;};}
const rng=seededRandom(1731),pool=[0,2,4],events=[];for(let i=0;i<4;i++){rng();events.push(pool[Math.floor(rng()*pool.length)]);}assert.deepEqual(events,[2,4,4,0]);assert.equal(288*60/120/96,1.5);console.log('Documentation-only reconstruction: pitch, capo, 6 intervals, key masks, C chord, rank transitions, seeded melody and duration passed.');
