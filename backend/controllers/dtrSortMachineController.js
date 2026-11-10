import {
  deleteDtrSortMachine,
  getDtrSortMachineById,
  insertDtrSortMachine,
  listDtrSortMachines,
  normalizeDtrMachineInput,
} from '../utils/dtrSortMachines.js';

export async function getDtrSortMachines(req, res) {
  try {
    const machines = await listDtrSortMachines();
    res.json({ machines });
  } catch (err) {
    console.error('getDtrSortMachines:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function getDtrSortMachine(req, res) {
  try {
    const machineId = String(req.params.machine_id || '').trim();
    const machine = await getDtrSortMachineById(machineId);
    if (!machine) return res.status(404).json({ error: 'Không tìm thấy máy' });
    res.json({ machine });
  } catch (err) {
    console.error('getDtrSortMachine:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function createDtrSortMachine(req, res) {
  try {
    const normalized = normalizeDtrMachineInput(req.body);
    if (normalized.error) return res.status(400).json({ error: normalized.error });

    const existing = await getDtrSortMachineById(normalized.machine_id);
    if (existing) {
      return res.status(409).json({ error: `machine_id "${normalized.machine_id}" đã tồn tại` });
    }

    const machine = await insertDtrSortMachine(normalized);
    res.status(201).json({ machine });
  } catch (err) {
    console.error('createDtrSortMachine:', err.message);
    if (err.code === '23505') {
      return res.status(409).json({ error: 'machine_id đã tồn tại' });
    }
    res.status(500).json({ error: 'Server error' });
  }
}

export async function removeDtrSortMachine(req, res) {
  try {
    const machineId = String(req.params.machine_id || '').trim();
    const deleted = await deleteDtrSortMachine(machineId);
    if (!deleted) return res.status(404).json({ error: 'Không tìm thấy máy' });
    res.json({ ok: true, machine_id: deleted.machine_id });
  } catch (err) {
    console.error('removeDtrSortMachine:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
}
