import assert from 'node:assert/strict';

import './xml-compare-table-categorized-shell-base.fixture.js';
import { flattenLevelDefinitions, levelChildCount, levelPathKey, renderTableCategorizedXmlShellHtml } from '../xml-compare/table-categorizer/table-categorized-xml-shell.js';

const includesAll=(html,labels)=>labels.forEach((label)=>assert.ok(html.includes(label), `missing ${label}`));
const setupTabButtonTag=(html,id)=>html.match(new RegExp(`<button[^>]*data-table-categorized-setup-tab="${id}"[^>]*>`))?.[0]||'';
const assertActiveSetupTab=(html,id)=>{const tag=setupTabButtonTag(html,id);assert.ok(tag, `setup tab button missing: ${id}`);assert.ok(tag.includes('class="is-active"'), `setup tab is not active: ${id}`);assert.ok(tag.includes('aria-selected="true"'), `active setup tab is not selected: ${id}`);assert.ok(html.includes(`data-setup-body="${id}"`), `setup body missing: ${id}`);};
const activePreviewButton=(html,label)=>html.match(new RegExp(`<button[^>]*class="is-active"[^>]*>${label}</button>`))?.[0]||'';
const assertActivePreview=(html,label)=>assert.ok(activePreviewButton(html,label), `preview tab not active: ${label}`);

const recursiveProfile={
  profileId:'recursive-level-test-profile',
  displayName:'Recursive Level Test Profile',
  levelDefinitions:[{
    levelId:'documentRoot',displayName:'Document Root',levelType:'document',creationMode:'single',xmlTag:'CategorizedTableXml',children:[{
      levelId:'modelSplit',displayName:'Model Split',levelType:'partition',creationMode:'static',xmlTag:'RootPartition',children:[{
        levelId:'groupA',displayName:'Group A',levelType:'group',creationMode:'perKey',xmlTag:'GroupA',keyResolver:{op:'column',sourceId:'S1',column:'Primary key'},displayNameResolver:{op:'column',sourceId:'S1',column:'Display'},fieldResolvers:{measure:{op:'column',sourceId:'S1',column:'Value / measure'}},children:[
          {levelId:'child1',displayName:'Child One',levelType:'item',creationMode:'perRow',xmlTag:'ChildOne',children:[{levelId:'detail1',displayName:'Detail One',levelType:'detail',creationMode:'perValue',xmlTag:'DetailOne'},{levelId:'detail2',displayName:'Detail Two',levelType:'detail',creationMode:'perValue',xmlTag:'DetailTwo'}]},
          {levelId:'child2',displayName:'Child Two',levelType:'item',creationMode:'perRow',xmlTag:'ChildTwo'},
          {levelId:'child3',displayName:'Child Three',levelType:'item',creationMode:'perRow',xmlTag:'ChildThree',children:[{levelId:'grandchild1',displayName:'Grandchild One',levelType:'detailGroup',creationMode:'perKey',xmlTag:'GrandchildOne',children:[{levelId:'greatGrandchild1',displayName:'Great Grandchild One',levelType:'detail',creationMode:'perValue',xmlTag:'GreatGrandchildOne',keyResolver:{op:'column',sourceId:'S1',column:'GreatKey'},displayNameResolver:{op:'column',sourceId:'S1',column:'GreatName'},fieldResolvers:{note:{op:'column',sourceId:'S1',column:'Notes'}},createOnlyWhen:'GreatKey exists',sortBy:'GreatKey',sourceScope:['S1'],notes:'Deep nested shell test'}]}]}
        ]
      },{levelId:'groupB',displayName:'Group B',levelType:'group',creationMode:'perKey',xmlTag:'GroupB'}]
    }]
  }]
};
const rows=flattenLevelDefinitions(recursiveProfile.levelDefinitions);
assert.ok(rows.length>=10);
assert.equal(levelPathKey([0,0,0,2,0,0]),'0.0.0.2.0.0');
assert.equal(levelChildCount(recursiveProfile.levelDefinitions[0].children[0].children[0]),3);
assert.equal(rows.find((row)=>row.level.levelId==='greatGrandchild1')?.depth,5);

const recursiveShell=renderTableCategorizedXmlShellHtml({activeTab:'graph',activeSetupTab:'structure',profile:recursiveProfile,selectedLevelPath:'0.0.0.2.0.0'});
assertActiveSetupTab(recursiveShell,'structure');
assertActivePreview(recursiveShell,'Graph View');
includesAll(recursiveShell,['data-level-tree','data-level-node','data-level-id="documentRoot"','data-level-id="modelSplit"','data-level-id="groupA"','data-level-id="child1"','data-level-id="child2"','data-level-id="child3"','data-level-id="grandchild1"','data-level-id="greatGrandchild1"','data-level-path="0.0.0.2.0.0"','data-level-depth="5"','data-level-child-count="3"','Document Root','Model Split','Group A','Group B','Child One','Child Two','Child Three','Detail One','Detail Two','Grandchild One','Great Grandchild One']);
includesAll(recursiveShell,['Selected Level','Level ID','Display Name','Level Name','Level Type','Creation Mode','XML Tag','Create From Column / Rule','Key Rule','Display Rule','Field Resolvers','Create Only When','Sort By','Child Levels','Source Scope','Notes','greatGrandchild1','GreatGrandchildOne','S1.GreatKey','S1.GreatName','note: S1.Notes','Deep nested shell test']);
includesAll(recursiveShell,['Add Child Level','Add Sibling Level','Duplicate Level','Move Up','Move Down','Delete Level','data-level-action="add-child"','data-level-action="add-sibling"','data-level-action="duplicate"','data-level-action="move-up"','data-level-action="move-down"','data-level-action="delete"']);

console.log('xml-compare-table-categorized-shell recursive extension: all assertions passed');
