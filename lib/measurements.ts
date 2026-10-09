// Storage and nutrition calculations stay in kg/cm; the app accepts U.S. units.
export const KG_PER_LB=0.45359237;
export const CM_PER_INCH=2.54;
export const poundsToKg=(pounds:number)=>pounds*KG_PER_LB;
export const kgToPounds=(kg:number)=>kg/KG_PER_LB;
export const inchesToCm=(inches:number)=>inches*CM_PER_INCH;
export const cmToInches=(cm:number)=>cm/CM_PER_INCH;
export function heightParts(cm:number){const tenths=Math.round(cmToInches(cm)*10);return {feet:Math.floor(tenths/120),inches:(tenths%120)/10};}
export function usProfileMeasurements(values:{feet:number;inches:number;weight:number;goalWeight:number}){
 const {feet,inches,weight,goalWeight}=values;
 if(!Number.isInteger(feet)||inches<0||inches>=12||![feet,inches,weight,goalWeight].every(Number.isFinite))throw new Error('Enter height in feet and inches, and weight in pounds.');
 const result={height:inchesToCm(feet*12+inches),weight:poundsToKg(weight),goalWeight:poundsToKg(goalWeight)};
 if(result.height<130||result.height>230)throw new Error('Enter a height between 4 ft 3.2 in and 7 ft 6.5 in.');
 if(result.weight<40||result.weight>250||result.goalWeight<40||result.goalWeight>250)throw new Error('Enter current and goal weights between 88.2 and 551.1 lbs.');
 return result;
}
