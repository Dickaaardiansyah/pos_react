// controllers/customerController.js
const { asyncHandler } = require("./_helpers");
const customerService = require("../services/customerService");

exports.getAllCustomers = asyncHandler(async (req, res) => {
  const { search, page, limit } = req.query;
  const result = await customerService.list({ search, page, limit });
  res.json({ success: true, data: result });
});

exports.getCustomerById = asyncHandler(async (req, res) => {
  const customer = await customerService.getById(req.params.id);
  res.json({ success: true, data: customer });
});

exports.createCustomer = asyncHandler(async (req, res) => {
  const customer = await customerService.create(req.body);
  res
    .status(201)
    .json({
      success: true,
      data: customer,
      message: "Pelanggan berhasil ditambahkan",
    });
});

exports.updateCustomer = asyncHandler(async (req, res) => {
  const customer = await customerService.update(req.params.id, req.body);
  res.json({
    success: true,
    data: customer,
    message: "Pelanggan berhasil diperbarui",
  });
});

exports.deleteCustomer = asyncHandler(async (req, res) => {
  await customerService.remove(req.params.id);
  res.json({ success: true, message: "Pelanggan berhasil dihapus" });
});
