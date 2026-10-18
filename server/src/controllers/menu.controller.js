
const service = require('../services/menu.service');

exports.getMenuItem = async (req, res) => {
  const item = await service.getMenuItem(req.params.id);
  res.json(item);
};

exports.getCookingDetdails = async(req, res)=>{
  const item = await service.getCookingDetails(req.body.ids);
  res.json(item);
}
