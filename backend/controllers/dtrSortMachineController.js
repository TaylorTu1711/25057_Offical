import pool from '../db.js';
import {
  deleteDtrSortMachine,
  getDtrSortMachineById,
  insertDtrSortMachine,
  listDtrSortMachines,
  normalizeDtrMachineInput,
  updateDtrSortMachine,
} from '../utils/dtrSortMachines.js';
import {
  getDtrCountsSeries,
  getDtrPeriodUtilization,
  getDtrStatusTimeline,
  getDtrUtilizationSummary,
} from '../utils/dtrTelemetry.js';
import {
  findMachineIdConflict,
  machineIdConflictMessage,
} from '../utils/machineSchema.js';

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

/**
 * GET KPI live + hiệu suất theo khung (mode/year/month/day giống counts).
 * utilization_pct = lifetime; period_utilization_pct = theo khung chọn.
 */
export async function getDtrSortMachineStats(req, res) {
  try {
    const machineId = String(req.params.machine_id || '').trim();
    const summary = await getDtrUtilizationSummary(pool, machineId);
    if (!summary) return res.status(404).json({ error: 'Không tìm thấy máy' });

    const mode = req.query.mode != null ? String(req.query.mode).trim().toLowerCase() : undefined;
    const year = req.query.year != null && req.query.year !== ''
      ? Number(req.query.year)
      : undefined;
    const month = req.query.month != null && req.query.month !== ''
      ? Number(req.query.month)
      : undefined;
    const day = req.query.day != null && req.query.day !== ''
      ? Number(req.query.day)
      : undefined;

    let period = null;
    if (mode) {
      period = await getDtrPeriodUtilization(pool, machineId, {
        mode,
        year,
        month,
        day,
      });
    }

    res.json({
      ...summary,
      period_utilization_pct: period?.period_utilization_pct ?? null,
      period_time_running: period?.period_time_running ?? null,
      period_seconds: period?.period_seconds ?? null,
      period_from: period?.from ?? null,
      period_to: period?.to ?? null,
      period_mode: period?.mode ?? null,
    });
  } catch (err) {
    console.error('getDtrSortMachineStats:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
}

/** GET timeline status chạy/dừng (0=dừng, 1=chạy). Query: from, to (ISO) hoặc hours. */
export async function getDtrSortMachineStatusTimeline(req, res) {
  try {
    const machineId = String(req.params.machine_id || '').trim();
    const machine = await getDtrSortMachineById(machineId);
    if (!machine) return res.status(404).json({ error: 'Không tìm thấy máy' });

    const from = req.query.from ? String(req.query.from) : undefined;
    const to = req.query.to ? String(req.query.to) : undefined;
    const hours = Number(req.query.hours) || 24;
    const series = await getDtrStatusTimeline(pool, machineId, { hours, from, to });
    res.json({
      machine_id: machine.machine_id,
      timestamps: series.timestamps,
      statusValues: series.statusValues,
      from: series.from,
      to: series.to,
    });
  } catch (err) {
    console.error('getDtrSortMachineStatusTimeline:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
}

/** GET counts theo giờ/ngày/tuần/tháng/quý/năm (stacked bar loại chai). */
export async function getDtrSortMachineCountsHourly(req, res) {
  try {
    const machineId = String(req.params.machine_id || '').trim();
    const machine = await getDtrSortMachineById(machineId);
    if (!machine) return res.status(404).json({ error: 'Không tìm thấy máy' });

    const mode = String(req.query.mode || 'hour').trim().toLowerCase();
    const year = req.query.year != null && req.query.year !== ''
      ? Number(req.query.year)
      : undefined;
    const month = req.query.month != null && req.query.month !== ''
      ? Number(req.query.month)
      : undefined;
    const day = req.query.day != null && req.query.day !== ''
      ? Number(req.query.day)
      : undefined;
    const hours = Number(req.query.hours) || 24;

    const series = await getDtrCountsSeries(pool, machineId, {
      mode,
      year,
      month,
      day,
      hours,
    });
    res.json({
      machine_id: machine.machine_id,
      mode: series.mode,
      keys: series.keys,
      buckets: series.buckets,
      // alias cũ
      hours: series.buckets,
    });
  } catch (err) {
    console.error('getDtrSortMachineCountsHourly:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function createDtrSortMachine(req, res) {
  try {
    const imagePath = req.file ? `/uploads/${req.file.filename}` : null;
    const normalized = normalizeDtrMachineInput(req.body, { imagePath });
    if (normalized.error) return res.status(400).json({ error: normalized.error });

    if (!normalized.image_url) {
      return res.status(400).json({ error: 'Thiếu hình ảnh máy' });
    }

    const conflict = await findMachineIdConflict(pool, normalized.machine_id);
    if (conflict) {
      return res.status(409).json({
        error: machineIdConflictMessage(normalized.machine_id, conflict),
        conflict_schema: conflict.schema,
      });
    }

    const machine = await insertDtrSortMachine(normalized);
    res.status(201).json({ machine });
  } catch (err) {
    console.error('createDtrSortMachine:', err.message);
    if (err.code === '23505') {
      return res.status(409).json({
        error: machineIdConflictMessage(req.body?.machine_id || req.body?.machineId),
      });
    }
    res.status(500).json({ error: 'Server error' });
  }
}

export async function updateDtrSortMachineInfo(req, res) {
  try {
    const machineId = String(req.params.machine_id || '').trim();
    const existing = await getDtrSortMachineById(machineId);
    if (!existing) return res.status(404).json({ error: 'Không tìm thấy máy' });

    const imagePath = req.file ? `/uploads/${req.file.filename}` : null;
    const normalized = normalizeDtrMachineInput(
      { ...req.body, machine_id: machineId },
      { imagePath },
    );
    if (normalized.error) return res.status(400).json({ error: normalized.error });

    const machine = await updateDtrSortMachine(machineId, {
      ...normalized,
      // Không upload ảnh mới → giữ ảnh cũ (COALESCE)
      image_url: imagePath,
    });
    if (!machine) return res.status(404).json({ error: 'Không tìm thấy máy' });
    res.json({ machine });
  } catch (err) {
    console.error('updateDtrSortMachineInfo:', err.message);
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
