import {useEffect,useState} from 'react';
import {SlidersHorizontal,Plus,Trash2} from 'lucide-react';
import {Dialog,DialogContent,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {foods} from '@/lib/foods';
import {foodName,priceLabel,type Language} from '@/lib/i18n';
import {emptyProfile,validateProfile,type PoolProfile} from '@/lib/personal-pool';
import type {Preferences} from '@/hooks/use-preferences';
export function PreferencesPanel({preferences:a,language,disabled,variant='header'}:{preferences:Preferences;language:Language;disabled:boolean;variant?:'header'|'inventory'}){
 const vi=language==='vi';const [open,setOpen]=useState(false),[draft,setDraft]=useState<PoolProfile>(emptyProfile),[search,setSearch]=useState(''),[tab,setTab]=useState<'builtIn'|'custom'>('builtIn');
 const [editing,setEditing]=useState<string|null>(null),[name,setName]=useState(''),[price,setPrice]=useState('50'),[veg,setVeg]=useState(false),[notice,setNotice]=useState(''),[confirmDelete,setConfirmDelete]=useState(false);
 useEffect(()=>{setDraft(a.profile)},[a.profile]);
 const resetForm=()=>{setEditing(null);setName('');setPrice('50');setVeg(false)};
 function add(){
  try{const item={id:editing||crypto.randomUUID(),name:name.trim(),price:Number(price),veg};const next=validateProfile({...draft,custom:editing?draft.custom.map(f=>f.id===editing?item:f):[...draft.custom,item]});updateDraft(next);resetForm();setNotice('')}catch{setNotice(vi?'Tên 1–60 ký tự, giá 10–500 nghìn, tối đa 50 món.':'Name: 1–60 characters, price: 10–500k VND, up to 50 dishes.')}
 }
 const dirty=JSON.stringify(draft)!==JSON.stringify(a.profile);
 const updateDraft=(next:PoolProfile)=>{setDraft(next);a.save(next)};
 return <><button className={variant==='inventory'?'customize-food-button':'preferences-button'} disabled={disabled} onClick={()=>{setDraft(a.profile);setNotice('');setConfirmDelete(false);setOpen(true)}} aria-label={variant==='inventory'?(vi?'Tuỳ chỉnh món ăn':'Customize food'):(vi?'Món của tôi':'My dishes')}>{variant==='inventory'?<><SlidersHorizontal size={16}/><span className="customize-full">{vi?'Tuỳ chỉnh món ăn':'Customize food'}</span><span className="customize-short">{vi?'Tuỳ chỉnh':'Customize'}</span></>:<><SlidersHorizontal size={17}/><span>{vi?'Món của tôi':'My dishes'}</span></>}</button>
 <Dialog open={open} onOpenChange={setOpen}><DialogContent className="preferences-dialog"><DialogTitle>{vi?'Món của tôi':'My dishes'}</DialogTitle><DialogDescription>{vi?'Tự động lưu lựa chọn bằng cookie trên máy này.':'Choices are automatically saved in cookies on this computer.'}</DialogDescription>
 <div className="pool-tabs"><button className={tab==='builtIn'?'selected':''} onClick={()=>setTab('builtIn')}>{vi?'Món có sẵn':'Catalog'} ({foods.length-draft.disabled.length})</button><button className={tab==='custom'?'selected':''} onClick={()=>setTab('custom')}>{vi?'Món tự thêm':'Custom'} ({draft.custom.length}/50)</button></div>
 <div className="pool-body"><fieldset>
 {tab==='builtIn'?<><input className="pool-search" placeholder={vi?'Tìm món…':'Search dishes…'} aria-label={vi?'Tìm món':'Search dishes'} value={search} onChange={e=>setSearch(e.target.value)}/><div className="pool-list">{foods.filter(f=>foodName(f,language).toLocaleLowerCase().includes(search.toLocaleLowerCase())).map(f=><label className="pool-row" key={f.image}><input type="checkbox" checked={!draft.disabled.includes(f.image)} onChange={e=>updateDraft({...draft,disabled:e.target.checked?draft.disabled.filter(id=>id!==f.image):[...draft.disabled,f.image]})}/><span>{foodName(f,language)}{f.veg?' · [Món chay]':''}</span><small>{priceLabel(f.price,language)}</small></label>)}</div><button className="subtle-button" onClick={()=>updateDraft({...draft,disabled:[]})}>{vi?'Bật lại tất cả món có sẵn':'Enable all catalog dishes'}</button></>:<>
 <div className="custom-form"><label>{vi?'Tên món':'Dish name'}<input value={name} maxLength={60} onChange={e=>setName(e.target.value)}/></label><label>{vi?'Giá (nghìn đồng)':'Price (thousand VND)'}<input type="number" min="10" max="500" step="1" inputMode="numeric" value={price} onChange={e=>setPrice(e.target.value)}/></label><label className="inline-check"><input type="checkbox" checked={veg} onChange={e=>setVeg(e.target.checked)}/>{vi?'Món chay':'Vegetarian'}</label><button className="pool-primary" onClick={add}><Plus size={16}/>{editing?(vi?'Cập nhật':'Update'):(vi?'Thêm món':'Add dish')}</button>{editing&&<button onClick={resetForm}>{vi?'Huỷ sửa':'Cancel edit'}</button>}</div>
 <div className="pool-list">{draft.custom.length===0&&<p>{vi?'Thêm quán cơm quen hoặc món tủ của bạn.':'Add your favorite lunch dish.'}</p>}{draft.custom.map(f=><div className="pool-row" key={f.id}><button onClick={()=>{setEditing(f.id);setName(f.name);setPrice(String(f.price));setVeg(f.veg)}}>{f.name}{f.veg?' · [Món chay]':''}</button><small>{priceLabel(f.price,language)}</small><button aria-label={`${vi?'Xóa':'Remove'} ${f.name}`} onClick={()=>{updateDraft({...draft,custom:draft.custom.filter(item=>item.id!==f.id)});if(editing===f.id)resetForm()}}><Trash2 size={15}/></button></div>)}</div></>}
 </fieldset></div>
 <div className="pool-save"><small>{foods.length-draft.disabled.length+draft.custom.length} {vi?'món trong hòm':'dishes in case'} · {dirty?(vi?'Chưa lưu':'Unsaved'):(vi?'Tự động lưu trên máy':'Saved automatically')}</small></div>
 <div className="preferences-bottom"><button onClick={async()=>{const p=await a.reload();if(p)setDraft(p)}}>{vi?'Tải lại cookie':'Reload cookies'}</button><button onClick={()=>setConfirmDelete(!confirmDelete)}>{vi?'Xóa danh sách đã lưu':'Clear saved dishes'}</button></div>{confirmDelete&&<div className="delete-confirm"><p>{vi?'Xóa danh sách món đã lưu trên trình duyệt này?':'Clear the saved food pool on this browser?'}</p><button onClick={async()=>{if(await a.remove())setOpen(false)}}>{vi?'Xác nhận xóa':'Confirm deletion'}</button></div>}

 {(a.error||notice)&&<p className="preferences-message" role="status">{a.error||notice}</p>}
 </DialogContent></Dialog></>;
}
