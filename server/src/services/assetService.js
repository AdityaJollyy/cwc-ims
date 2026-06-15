const assetRepository = require('../repositories/assetRepository');
const { parsePagination, buildPaginationMeta } = require('../utils/pagination');
const ApiError = require('../utils/ApiError');

/**
 * Asset Service
 * Business logic for asset management.
 * asset_id is admin-entered and immutable after creation.
 */

const getAll = async (queryParams) => {
  const { page, limit, offset } = parsePagination(queryParams);
  const { search, category_id, status } = queryParams;

  const { rows, total } = await assetRepository.findAll({
    search,
    category_id: category_id ? parseInt(category_id, 10) : undefined,
    status,
    limit,
    offset,
  });

  return {
    assets: rows,
    meta: buildPaginationMeta(total, page, limit),
  };
};

const getById = async (id) => {
  const asset = await assetRepository.findById(id);
  if (!asset) {
    throw ApiError.notFound(`Asset not found`);
  }
  return asset;
};

const create = async (data, userId) => {
  const { asset_id, ...rest } = data;

  // Check asset_id uniqueness
  const existing = await assetRepository.findByAssetId(asset_id);
  if (existing) {
    throw ApiError.conflict(`Asset ID "${asset_id}" is already in use`);
  }

  return assetRepository.create({ ...rest, asset_id, created_by: userId });
};

const update = async (id, data) => {
  const asset = await assetRepository.findById(id);
  if (!asset) {
    throw ApiError.notFound(`Asset not found`);
  }
  return assetRepository.update(id, data);
};

const updateStatus = async (id, status) => {
  const asset = await assetRepository.findById(id);
  if (!asset) {
    throw ApiError.notFound(`Asset not found`);
  }

  if (status === 'assigned') {
    throw ApiError.badRequest('Cannot manually set status to "assigned". Use the assignments module.');
  }

  if (asset.status === 'assigned') {
    throw ApiError.conflict('Cannot change status of an assigned asset. Please return the asset first.');
  }

  return assetRepository.updateStatus(id, status);
};

const deleteAsset = async (id) => {
  const asset = await assetRepository.findById(id);
  if (!asset) {
    throw ApiError.notFound(`Asset not found`);
  }
  if (asset.status === 'assigned') {
    throw ApiError.conflict(
      `Cannot delete this asset — it is currently assigned. Please return it first.`
    );
  }
  // Delete related assignment records first (no ON DELETE CASCADE on assignments table)
  await assetRepository.deleteAssignmentsByAssetId(id);
  await assetRepository.deleteAsset(id);
  return true;
};

module.exports = { getAll, getById, create, update, updateStatus, deleteAsset };

