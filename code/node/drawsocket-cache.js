
/**
 * consider adding a parent ID lookup, so we can remove all children of a parent.
 * actually, we really do need that, because even just removing a parent, doesn't remove the children, they will still be there but fail to draw on init if the parent is not there
 */

'use strict';

const mixin = require('mixin-deep');
const fs = require('fs');

//const Max = require('max-api');


class StateCache
{
  constructor() {

    this.cache_map = new Map();
    this.parent_sets = new Map();
    this.cache_obj = []; // pre stringified JSON for fast sending

    this.input = this.input.bind(this);

    this.clearAll = this.clearAll.bind(this);
    this.removeKey = this.removeKey.bind(this);
    this.removeId = this.removeId.bind(this);
    this.removeKeymapRefs = this.removeKeymapRefs.bind(this);
    this.clearChildren = this.clearChildren.bind(this);

    this.makeObj = this.makeObj.bind(this);
    this.unionIdMap = this.unionIdMap.bind(this);
    this.cacheKeys = this.cacheKeys.bind(this);

    this.writeToFile = this.writeToFile.bind(this);
    this.appendToFile = this.writeToFile.bind(this);
  }

  clearAll()
  {
    this.cache_map = new Map();
    this.parent_sets = new Map();
    this.cache_obj = []; 
  }


  unionIdMap(cached_id_map_, objarr_, timetag_)
  {
    let iterobj_ = Array.isArray(objarr_) ? objarr_ : [ objarr_ ];
    for( let o of iterobj_ )
    {
      const id_ = o.hasOwnProperty('id') ? o.id : ( o.hasOwnProperty('selector') ? o.selector : null );
      if( id_ )
      {
          if( !o.timetag )
          {
            o.timetag = timetag_;
          }

          if( cached_id_map_.has(id_) && !o.hasOwnProperty('new') )
              mixin( cached_id_map_.get(id_), o );
          else
          {
            if( cached_id_map_.has(id_) )
            {
              this.removeId(id_);
            }

            cached_id_map_.set(id_, o );
            if( o.hasOwnProperty('parent') )
            {
              if( this.parent_sets.has(o.parent) )
                this.parent_sets.get(o.parent).add(id_);
              else
                this.parent_sets.set(o.parent, new Set([id_]) );

            }
          }
      }
      else
      {
        cached_id_map_.set(Date.now(), o);
      }
    }
  }
  
  
  cacheKeys(k_obj_, timetag_)
  {
      let iterobj_ = Array.isArray(k_obj_) ? k_obj_ : [ k_obj_ ];
      for( let ko of iterobj_)
      {
        if( !ko.hasOwnProperty('key') || !ko.hasOwnProperty('val') )
            continue;
        
        switch(ko.key)
        {
            case "clear":
              
              if( ko.val === "*" )
                this.clearAll();
              else if( this.cache_map.has( ko.val ) )
                this.removeKey( ko.val );
              else  
                this.clearChildren(ko.val);

            break;
            case "remove":
                this.removeId(ko.val);
            break;
            default:
                if( ko.val === "clear")
                {
                    this.removeKey(ko.key);
                }
                else
                {
                    let k_id_map;
                    if( this.cache_map.has( ko.key ) )
                        k_id_map = this.cache_map.get(ko.key) 
                    else
                    {
                        k_id_map = new Map();
                        this.cache_map.set(ko.key, k_id_map);
                    }

                    this.unionIdMap(k_id_map, ko.val, timetag_);
                }
                
            break;
        }

      }
  }

  makeObj()
  {
    this.cache_obj = [];
    this.cache_map.forEach( (value_, key_, map_) =>{
        this.cache_obj.push({
            key: key_,
            val: Array.from( value_.values() ) // << timetag has to be in there
        });
    });
    this.cache_obj = JSON.stringify(this.cache_obj);

  }

  input(obj_, timetag_)
  {
    this.cacheKeys(obj_, timetag_);
    this.makeObj();

//   console.log("updated", this.cache_map);

   //console.log(" ob", this.cache_obj);

  }

  clearChildren(_name)
  {
//    console.log("clearChildren");

    if( !this.parent_sets.has(_name) )
      return;

    this.parent_sets.get(_name).forEach((value) => {

        const iter_ids = Array.isArray(value) ? value : [value];
      
        this.cache_map.forEach( (value_, key_, map_) => {
          for( let id of iter_ids ) {
            value_.delete(id);
          }
        });

    });

    // note: does not delete the parent, just the children
    
    this.makeObj();

  }

  removeKey(kname)
  {
    // console.log("removeKey");

    if( !Array.isArray(kname) )
    {
      if( !this.cache_map.has(kname) )
        return;
        
      let kmap = this.cache_map.get(kname);
      kmap.forEach( (value, key, map) => {
        this.parent_sets.delete(key);
      });
      this.cache_map.delete(kname);
    }
    else
    {
      for( let k of kname )
      {
        if( !this.cache_map.has(kname) )
          continue;

        let kmap = this.cache_map.get(kname);
        kmap.forEach( (value, key, map) => {
          this.parent_sets.delete(key);
        });
        
        this.cache_map.delete(k);

      }
    }

    this.makeObj();

//    console.log("reemoved", this.cache_map);
//    console.log(" ob", this.cache_obj);
  }


  removeKeymapRefs(kmap_, id_)
  {
    const rm = kmap_.get(id_);
          
    if( rm && rm.hasOwnProperty('parent') && 
        this.parent_sets.has(rm.parent) )
    {
      this.parent_sets.get(rm.parent).delete(id_);
    }
    
    if( this.parent_sets.has(id_) ) // delete children if this object is a parent
    {
      this.clearChildren(id_);
      this.parent_sets.delete(id_);
    }

    kmap_.delete(id_);
  }


  removeId(id_)
  {
 
    if( !Array.isArray(id_) )
    {
        this.cache_map.forEach( (value_, key_, map_) => {
          this.removeKeymapRefs(value_, id_);
        });    
    }
    else
    {
        this.cache_map.forEach( (value_, key_, map_)=>{
          for( let i of id_ )
          {
            this.removeKeymapRefs(value_, i);
          }
        });
    }

    this.makeObj();

//    console.log("reemoved", this.cache_map);
//    console.log(" ob", this.cache_obj);
  }


  writeToFile(filename, prefix)
  {
    fs.writeFile(filename, `{ "${prefix}" : ${this.cache_obj} }`, (err) => {
      if( err ){
        return err;
      }
    });
    return null;
  }

  appendToFile(filename, prefix)
  {
    fs.appendFile(filename, `, { "${prefix}" : ${this.cache_obj} }`, (err) => {
      if( err ){
        return err;
      }
    });
    return null;
  }


}


class ClientState
{
  constructor() {

    this.state = new Map();
    this.update = this.update.bind(this);

    this.get = this.get.bind(this);
  }

  update(prefix_, obj_, timetag_)
  {

    if( !this.state.has(prefix_) )
    {
      this.state.set( prefix_, new StateCache() );

      if( this.state.has("/*") )
      {
        this.state.get(prefix_).cache_map = new Map(this.state.get("/*").cache_map);
      }
    }
    
    if( prefix_ === "/*" )
    {
      this.state.forEach( (value, key, map)=>{
        value.input(obj_, timetag_);
      });
    }
    else
      this.state.get(prefix_).input(obj_, timetag_);
  }

  get(prefix_)
  {

    if( this.state.has(prefix_) )
    {
      return this.state.get(prefix_).cache_obj;
    }
    else if( this.state.has("/*") )
    {
      return this.state.get("/*").cache_obj;
    }
    else
      return null;
  }

  writeToFile(filename, prefix)
  {

    if( typeof prefix === 'undefined' )
    {

      // accum string? ...         value.cache_obj
  
      let cache_str = "{";
      let started = false;
      this.state.forEach( (value, key, map)=>{
        if( started )
          cache_str += ",";

        cache_str += ` "${key}" : ${value.cache_obj}`
        started = true;
        
      });    

      cache_str += "}";

      fs.writeFile(filename, cache_str, (err)=>{
        if( err ){
          return err;
        }
      });

    }
    else if( this.state.has(prefix) )
    {
      return this.state.get(prefix).writeToFile(filename, prefix);
    }

    return null;
  }

}

module.exports = new ClientState();
