import { ShopService } from '../services/shopService.js';

export class ShopController {
  static getShop(req, res, next) {
    try {
      res.json(ShopService.getShop(req.user.id));
    } catch (err) {
      next(err);
    }
  }

  static purchase(req, res, next) {
    try {
      res.json(ShopService.purchase(req.user.id, req.body?.itemId));
    } catch (err) {
      next(err);
    }
  }

  static equip(req, res, next) {
    try {
      res.json(ShopService.equip(req.user.id, req.body?.itemId));
    } catch (err) {
      next(err);
    }
  }

  static adminList(req, res, next) {
    try {
      res.json(ShopService.listAdminItems());
    } catch (err) {
      next(err);
    }
  }

  static adminCreate(req, res, next) {
    try {
      res.status(201).json(ShopService.createItem(req.body || {}));
    } catch (err) {
      next(err);
    }
  }

  static adminUpdate(req, res, next) {
    try {
      res.json(ShopService.updateItem(req.params.itemId, req.body || {}));
    } catch (err) {
      next(err);
    }
  }

  static adminDelete(req, res, next) {
    try {
      res.json(ShopService.deleteItem(req.params.itemId));
    } catch (err) {
      next(err);
    }
  }
}
