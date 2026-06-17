const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess, sendCreated } = require('../utils/ApiResponse');
const assetService = require('../services/assetService');

/**
 * Asset Controller
 */

/** GET /api/assets */
const getAllAssets = asyncHandler(async (req, res) => {
  console.log('[assets] GET /api/assets query =', req.query);
  const result = await assetService.getAll(req.query);
  sendSuccess(res, result.assets, 'Assets retrieved successfully', 200, result.meta);
});

/** GET /api/assets/:id */
const getAsset = asyncHandler(async (req, res) => {
  const asset = await assetService.getById(req.params.id);
  sendSuccess(res, asset, 'Asset retrieved successfully');
});

/** POST /api/assets */
const createAsset = asyncHandler(async (req, res) => {
  const asset = await assetService.create(req.body, req.user.id);
  sendCreated(res, asset, 'Asset created successfully');
});

/** PUT /api/assets/:id */
const updateAsset = asyncHandler(async (req, res) => {
  const asset = await assetService.update(req.params.id, req.body);
  sendSuccess(res, asset, 'Asset updated successfully');
});

/** PATCH /api/assets/:id/status */
const updateAssetStatus = asyncHandler(async (req, res) => {
  const asset = await assetService.updateStatus(req.params.id, req.body.status);
  sendSuccess(res, asset, 'Asset status updated successfully');
});

/** DELETE /api/assets/:id */
const deleteAsset = asyncHandler(async (req, res) => {
  await assetService.deleteAsset(req.params.id);
  sendSuccess(res, null, 'Asset deleted successfully');
});

module.exports = { getAllAssets, getAsset, createAsset, updateAsset, updateAssetStatus, deleteAsset };
