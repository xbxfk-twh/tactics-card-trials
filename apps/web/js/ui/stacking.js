/* Preview the actual rule to detect stacking, including summon and movement skills. */
(function () {
  'use strict';
  function proposal(game,action,payload) {
    if(!['move','deploy','skill','hand'].includes(action))return null;
    const probe=new window.TacticsGame();probe.restore(game.snapshot());
    const p={x:payload.x,y:payload.y};
    const valid=action==='move'?probe.move(payload.uid,p):action==='deploy'?probe.deploy(payload.id,p):
      action==='skill'?probe.useSkill(payload.uid,payload.id,p,payload.targetUid??null):probe.playHand(payload.id,p,payload.targetUid??null);
    if(!valid)return null;
    const arrivals=[];
    for(const unit of probe.units){
      const before=game.unit(unit.uid);
      if(before&&before.x===unit.x&&before.y===unit.y)continue;
      const residents=game.at(unit).filter(u=>u.team===unit.team&&u.uid!==unit.uid&&probe.unit(u.uid));
      if(residents.length)arrivals.push({id:unit.id,pos:{x:unit.x,y:unit.y},residents:residents.map(u=>u.id),count:probe.at(unit).length});
    }
    return arrivals.length?{arrivals,fingerprint:JSON.stringify(game.snapshot())}:null;
  }
  window.StackingConfirmation={proposal};
})();
