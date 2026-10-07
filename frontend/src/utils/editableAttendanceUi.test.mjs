import test from 'node:test'
import assert from 'node:assert/strict'
import { attendanceDraftPage, discardAttendanceRowResult } from './editableAttendance.mjs'

test('large preview renders only 25 rows per page with stable original indexes', () => {
  const rows=Array.from({length:5000},(_,i)=>({row:i+2}))
  const page=attendanceDraftPage(rows,1)
  assert.equal(page.rows.length,25)
  assert.equal(page.rows[0].row,27)
  assert.equal(page.start,25)
  assert.equal(page.pages,200)
  assert.equal(attendanceDraftPage(rows,900).current,199)
  assert.equal(attendanceDraftPage([],1).current,0)
})
test('correcting one row keeps system correction hints for the other rows, never stale green for edited row',()=>{
  const response={dry_run:true,rows:[{row:2,system_status:'existing'},{row:3,system_status:'conflict',correction_fields:['nik']}],errors:[{row:2,column:'NIP'},{row:3,column:'NIK'}]}
  const next=discardAttendanceRowResult(response,2)
  assert.deepEqual(next.rows,[response.rows[1]])
  assert.deepEqual(next.errors,[response.errors[1]])
  assert.equal(response.rows.length,2)
  assert.equal(discardAttendanceRowResult(null,2),null)
})
