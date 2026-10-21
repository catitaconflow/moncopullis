import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  importarExportacion,
  validarExportacion,
  type AlmacenImportacion,
  type RegistroExportado,
} from '../src/importacion.ts';

const UUID = '6f1c2d3e-4a5b-4c6d-8e7f-901234567890';

function registro(extra: Partial<RegistroExportado> = {}): RegistroExportado {
  return { uuid: UUID, entidad: 'animal', datos: { diio: '123456789' }, ...extra };
}

function almacenFalso(): AlmacenImportacion & { escritos: RegistroExportado[][] } {
  const ids = new Set<string>();
  const escritos: RegistroExportado[][] = [];
  return {
    escritos,
    async importarSiNuevo(exportId, registros) {
      if (ids.has(exportId)) return false;
      ids.add(exportId);
      escritos.push(registros);
      return true;
    },
  };
}

test('importa un export nuevo y reporta la cantidad', async () => {
  const almacen = almacenFalso();
  const res = await importarExportacion({ export_id: 'exp-1', registros: [registro()] }, almacen);
  assert.deepEqual(res, { estado: 'importado', cantidad: 1 });
  assert.equal(almacen.escritos.length, 1);
});

test('un segundo envío del mismo export no escribe otra vez (idempotencia)', async () => {
  const almacen = almacenFalso();
  const cuerpo = { export_id: 'exp-1', registros: [registro()] };
  await importarExportacion(cuerpo, almacen);
  const res = await importarExportacion(cuerpo, almacen);
  assert.deepEqual(res, { estado: 'ya_importado' });
  assert.equal(almacen.escritos.length, 1);
});

test('no escribe nada si un registro tiene uuid inválido (todo o nada)', async () => {
  const almacen = almacenFalso();
  const res = await importarExportacion(
    { export_id: 'exp-2', registros: [registro(), registro({ uuid: 'no-es-uuid' })] },
    almacen,
  );
  assert.equal(res.estado, 'invalido');
  assert.equal(almacen.escritos.length, 0);
});

test('rechaza entidades fuera de la lista permitida', () => {
  const res = validarExportacion({ export_id: 'exp-3', registros: [registro({ entidad: 'usuario' })] });
  assert.match(res.errores.join(' '), /entidad no permitida/);
});

test('rechaza un export sin export_id', () => {
  const res = validarExportacion({ registros: [] });
  assert.deepEqual(res.errores, ['export_id obligatorio']);
});

test('rechaza registros que no son una lista', () => {
  const res = validarExportacion({ export_id: 'exp-4', registros: 'texto' });
  assert.deepEqual(res.errores, ['registros debe ser una lista']);
});

test('rechaza datos que no son un objeto', () => {
  const res = validarExportacion({ export_id: 'exp-5', registros: [registro({ datos: [] as never })] });
  assert.match(res.errores.join(' '), /datos debe ser un objeto/);
});
