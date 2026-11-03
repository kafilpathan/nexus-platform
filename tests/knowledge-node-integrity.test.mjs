import test from "node:test";
import assert from "node:assert/strict";
import { findDuplicateKnowledgeNode } from "../cloudflare/knowledge-node-integrity.js";
const candidate={label:"Graph Theory",node_type:"concept",source_url:"https://example.com/graph"};
test("detects duplicate source URLs independent of case",()=>{const found=findDuplicateKnowledgeNode(candidate,[{id:"1",label:"Other",node_type:"paper",source_url:"HTTPS://EXAMPLE.COM/GRAPH"}]);assert.equal(found.id,"1");});
test("detects duplicate normalized label and type",()=>{const found=findDuplicateKnowledgeNode(candidate,[{id:"2",label:" graph theory ",node_type:"CONCEPT",source_url:null}]);assert.equal(found.id,"2");});
test("does not mark distinct source and identity as duplicate",()=>{assert.equal(findDuplicateKnowledgeNode(candidate,[{label:"Different",node_type:"concept",source_url:"https://other.test"}]),null);});
test("handles missing and invalid inputs safely",()=>{assert.equal(findDuplicateKnowledgeNode(null,[]),null);assert.equal(findDuplicateKnowledgeNode(candidate,null),null);});
