import { Controller, Get } from '@nestjs/common';

import { User } from '@db/models/User';

@Controller('api/v1/healthcheck')
export class HealthcheckController {
  @Get()
  async ping() {
    await User.findAll();
    return {
      OK: true,
    };
  }
}
