import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { QueryUsersDto } from './dto/query-users.dto';
import { ApproveUserDto } from './dto/approve-user.dto';
import { ReasonDto } from '../../common/dto/reason.dto';
import { ChangeRoleDto } from './dto/change-role.dto';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { Permission } from '../../common/constants/permissions.constant';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';

@ApiTags('users')
@ApiBearerAuth('access-token')
@Controller('users')
@RequirePermissions(Permission.USERS_MANAGE)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  findAll(@Query() query: QueryUsersDto) {
    return this.usersService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.findById(id);
  }

  @Post(':id/approve')
  approve(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ApproveUserDto,
    @CurrentUser() admin: AuthenticatedUser,
  ) {
    return this.usersService.approve(id, admin.sub, dto);
  }

  @Post(':id/reject')
  reject(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReasonDto,
    @CurrentUser() admin: AuthenticatedUser,
  ) {
    return this.usersService.reject(id, admin.sub, dto.reason);
  }

  @Post(':id/block')
  block(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReasonDto,
    @CurrentUser() admin: AuthenticatedUser,
  ) {
    return this.usersService.block(id, admin.sub, dto.reason);
  }

  @Post(':id/unblock')
  unblock(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() admin: AuthenticatedUser) {
    return this.usersService.unblock(id, admin.sub);
  }

  @Patch(':id/role')
  changeRole(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ChangeRoleDto,
    @CurrentUser() admin: AuthenticatedUser,
  ) {
    return this.usersService.changeRole(id, admin.sub, dto.roleName);
  }
}
