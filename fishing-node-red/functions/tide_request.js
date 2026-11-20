// Fan out only when a 48-hour window crosses a Hong Kong calendar-year boundary.
const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
  timeZone:'Asia/Hong_Kong',year:'numeric',month:'2-digit',day:'2-digit'
}).formatToParts(new Date()).map(part=>[part.type,part.value]));
const year=Number(parts.year),month=Number(parts.month),day=Number(parts.day);
const years=[year];
if(month===1&&day<=3)years.push(year-1);
if(month===12&&day>=29)years.push(year+1);
for(const tideYear of years){
  node.send({...msg,tideYear,url:`https://data.weather.gov.hk/weatherAPI/opendata/opendata.php?dataType=__DATA_TYPE__&station=QUB&year=${tideYear}&rformat=csv`});
}
return null;
