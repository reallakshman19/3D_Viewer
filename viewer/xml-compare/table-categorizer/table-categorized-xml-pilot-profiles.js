import { DEFAULT_COORDINATE_CLUSTER_CONTRACT } from './table-categorized-xml-coordinate-cluster.js';

export const PS_MAPPING_TABLE_2_SAMPLE=`PS NO\tBore\tpipe\tDTXR\tSupport Gap\tMandatory\tX\tY\tZ
PS-XYZ.1\tDN80\tLINE-A\tGUIDE\t10\tYES\t1000\t2000\t3000
PS-XYZ.2\tDN80\tLINE-A\tLINE STOP\t0\tYES\t1001\t2000\t3000
PS-XYZ.7\tDN80\tLINE-A\tREST\t-\tYES\t999.5\t2000\t3000
PS-XYZ.10\tDN80\tLINE-A\tGUIDE\t10\tYES\t1000.2\t2000\t3000
PS-XYZ.3\tDN80\tLINE-A\tGUIDE\t10\tYES\t1500\t2000\t3000
PS-ABC.1\tDN80\tLINE-A\tGUIDE\t10\tYES\t1000\t2000\t3000`;

const psNo={op:'trim',column:'PS NO'};
const psBase={op:'fallback',resolvers:[{op:'regexExtract',input:psNo,pattern:'^(.+?)\\.\\d+$',group:1}],defaultResolver:psNo};
const cluster={op:'coordinateCluster',contract:DEFAULT_COORDINATE_CLUSTER_CONTRACT};
const feature={op:'classifier',column:'DTXR'};

export const PS_MAPPING_TABLE_2_SHADOW_PROFILE=Object.freeze({
  schema:'UniversalCategorizerProfile.v1',
  profileId:'ps-mapping-table-2-shadow-profile',
  displayName:'PS Mapping Table 2 Shadow Profile',
  requiredColumns:Object.freeze(['PS NO','Bore','pipe','DTXR','Support Gap','Mandatory']),
  optionalColumns:Object.freeze(['X','Y','Z']),
  duplicateKeyPolicy:'merge-sourceRefs',
  multiValuePolicy:'single-feature-per-row',
  coordinateCluster:Object.freeze(DEFAULT_COORDINATE_CLUSTER_CONTRACT),
  levelDefinitions:Object.freeze([
    Object.freeze({
      levelId:'categorizedTableGraph',levelType:'container',creationMode:'static',
      key:'CategorizedTableGraph',displayName:'CategorizedTableGraph',documentRoot:true,
      children:Object.freeze([
        Object.freeze({
          levelId:'rootPartition',levelType:'partition',creationMode:'static',
          key:'MODEL_SIDE',displayName:'RootPartition: MODEL_SIDE',
          children:Object.freeze([
            Object.freeze({
              levelId:'supportFamily',levelType:'group',creationMode:'one-per-key',
              keyResolver:{op:'fallback',resolvers:[{op:'concat',parts:[psBase,'__',cluster]}],defaultResolver:psBase},
              displayNameResolver:psBase,
              children:Object.freeze([
                Object.freeze({
                  levelId:'supportOccurrence',levelType:'occurrence',creationMode:'one-per-key',
                  keyResolver:psNo,displayNameResolver:psNo,
                  children:Object.freeze([
                    Object.freeze({
                      levelId:'supportFeature',levelType:'feature',creationMode:'one-per-key',
                      keyResolver:{op:'concat',parts:[psNo,'_',feature]},displayNameResolver:feature,
                      fieldResolvers:Object.freeze({featureType:feature}),
                      children:Object.freeze([
                        Object.freeze({
                          levelId:'gap',levelType:'measure',creationMode:'zero-or-one',
                          keyResolver:{op:'concat',parts:[psNo,'_',feature,'_Gap']},
                          displayName:'Gap',fieldResolvers:Object.freeze({
                            rawValue:{op:'trim',column:'Support Gap'},
                            value:{op:'numberParser',column:'Support Gap',severity:'INFO'}
                          })
                        })
                      ])
                    })
                  ])
                })
              ])
            })
          ])
        })
      ])
    })
  ])
});
